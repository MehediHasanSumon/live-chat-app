<?php

use App\Events\Domain\ConversationCallStateChanged;
use App\Events\Domain\UserCallSignaled;
use App\Listeners\BroadcastConversationCallStateChanged;
use App\Models\CallRoom;
use App\Models\CallRoomParticipant;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\User;
use App\Models\UserSetting;
use App\Providers\EventServiceProvider;
use App\Services\LiveKit\LiveKitRoomService;
use App\Services\LiveKit\LiveKitTokenService;
use App\Services\LiveKit\LiveKitWebhookService;
use App\Services\Calls\CallService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

function createCallGroupConversation(User $owner, array $members, array $settings = []): Conversation
{
    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Group Call',
        'created_by' => $owner->id,
        'settings_json' => $settings,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    foreach ($members as $member) {
        ConversationMember::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $member->id,
            'role' => 'member',
            'membership_state' => 'active',
            'joined_at' => now(),
        ]);
    }

    return $conversation;
}

it('starts a direct voice call and dispatches incoming call fanout', function () {
    Event::fake([
        ConversationCallStateChanged::class,
        UserCallSignaled::class,
    ]);

    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    UserSetting::query()->create([
        'user_id' => $recipient->id,
        'show_active_status' => true,
        'allow_message_requests' => false,
        'push_enabled' => true,
        'sound_enabled' => true,
        'vibrate_enabled' => true,
        'quiet_hours_enabled' => false,
        'theme' => 'system',
        'updated_at' => now(),
    ]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('createRoom')
        ->once()
        ->withArgs(function (string $roomName, array $options): bool {
            return $roomName !== ''
                && $options['max_participants'] === 2;
        })
        ->andReturn([
            'name' => 'stub-room',
        ]);

    $this->app->instance(LiveKitRoomService::class, $roomService);

    $response = $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice");

    $response
        ->assertCreated()
        ->assertJsonPath('data.scope', 'direct')
        ->assertJsonPath('data.media_type', 'voice')
        ->assertJsonPath('data.max_participants', 2)
        ->assertJsonPath('data.max_video_publishers', 0);

    $roomUuid = $response->json('data.room_uuid');
    $callRoom = CallRoom::query()->where('room_uuid', $roomUuid)->firstOrFail();

    expect($callRoom->status)->toBe('ringing')
        ->and($callRoom->conversation->active_room_uuid)->toBe($roomUuid)
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $caller->id)
                ->value('invite_status')
        )->toBe('accepted')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $recipient->id)
                ->value('invite_status')
        )->toBe('ringing');

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($roomUuid): bool {
        return $event->callRoom->room_uuid === $roomUuid
            && $event->action === 'started';
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($recipient, $roomUuid): bool {
        return $event->userId === $recipient->id
            && $event->eventName === 'call.incoming'
            && $event->payload['call_room']['room_uuid'] === $roomUuid;
    });
});

it('issues join tokens only for accepted participants and enforces the video publisher cap', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('createRoom')->once()->andReturn(['name' => 'stub-room']);
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $createResponse = $this->actingAs($owner, 'web')
        ->postJson("/api/conversations/{$conversation->id}/calls/group/video");

    $createResponse->assertCreated();

    $roomUuid = $createResponse->json('data.room_uuid');
    $callRoom = CallRoom::query()->where('room_uuid', $roomUuid)->firstOrFail();
    $callRoom->forceFill([
        'max_video_publishers' => 1,
    ])->save();

    $callCount = 0;
    $tokenService = \Mockery::mock(LiveKitTokenService::class);
    $tokenService->shouldReceive('issueJoinToken')
        ->twice()
        ->andReturnUsing(function (User $user, string $roomName, array $permissions) use (&$callCount, $memberA, $memberB, $roomUuid): array {
            $callCount++;
            expect($roomName)->toBe($roomUuid);

            if ($callCount === 1) {
                expect($permissions['can_publish_sources'])->toBe(['microphone', 'camera']);

                return [
                    'token' => 'video-token',
                    'url' => 'http://127.0.0.1:7880',
                    'room' => $roomUuid,
                    'identity' => (string) $user->id,
                    'ttl' => 3600,
                ];
            }

            if ($callCount === 2) {
                expect($permissions['can_publish_sources'])->toBe(['microphone']);

                return [
                    'token' => 'audio-token',
                    'url' => 'http://127.0.0.1:7880',
                    'room' => $roomUuid,
                    'identity' => (string) $user->id,
                    'ttl' => 3600,
                ];
            }

            throw new RuntimeException('Unexpected join token user.');
        });

    $this->app->instance(LiveKitTokenService::class, $tokenService);

    $callService = app(CallService::class);
    $callService->accept($callRoom, $memberA->id);
    $callService->accept($callRoom, $memberB->id);

    $memberAPayload = $callService->issueJoinToken($callRoom->fresh(), $memberA->fresh(), true);

    expect($memberAPayload['publish_mode'])->toBe('video')
        ->and($memberAPayload['token']['token'])->toBe('video-token');

    $memberBPayload = $callService->issueJoinToken($callRoom->fresh(), $memberB->fresh(), true);

    expect($memberBPayload['publish_mode'])->toBe('audio')
        ->and($memberBPayload['token']['token'])->toBe('audio-token');

    expect(
        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->where('user_id', $memberA->id)
            ->value('is_video_publisher')
    )->toBeTrue();

    expect(
        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->where('user_id', $memberB->id)
            ->value('is_video_publisher')
    )->toBeFalse();
});

it('syncs livekit webhook events into call room state and clears the active room when finished', function () {
    Event::fake([
        ConversationCallStateChanged::class,
    ]);

    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createCallGroupConversation($caller, [$recipient]);
    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'direct',
        'media_type' => 'voice',
        'created_by' => $caller->id,
        'status' => 'ringing',
        'max_participants' => 2,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $caller->id,
        'invite_status' => 'accepted',
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'accepted',
    ]);

    $webhookService = Mockery::mock(LiveKitWebhookService::class);
    $webhookService->shouldReceive('parse')
        ->once()
        ->andReturn([
            'event' => 'participant_joined',
            'room' => ['name' => $callRoom->room_uuid],
            'participant' => ['identity' => (string) $recipient->id],
        ]);

    $this->app->instance(LiveKitWebhookService::class, $webhookService);

    $this->postJson('/api/webhooks/livekit')
        ->assertOk()
        ->assertJsonPath('event', 'participant_joined')
        ->assertJsonPath('call_room', $callRoom->room_uuid);

    expect($callRoom->fresh()->status)->toBe('active')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $recipient->id)
                ->value('joined_at')
        )->not->toBeNull();

    $finishWebhookService = Mockery::mock(LiveKitWebhookService::class);
    $finishWebhookService->shouldReceive('parse')
        ->once()
        ->andReturn([
            'event' => 'room_finished',
            'room' => ['name' => $callRoom->room_uuid],
        ]);

    $this->app->instance(LiveKitWebhookService::class, $finishWebhookService);

    $this->postJson('/api/webhooks/livekit')
        ->assertOk()
        ->assertJsonPath('event', 'room_finished');

    expect($callRoom->fresh()->status)->toBe('ended')
        ->and($conversation->fresh()->active_room_uuid)->toBeNull();

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($callRoom): bool {
        return $event->callRoom->room_uuid === $callRoom->room_uuid
            && in_array($event->action, ['participant_joined', 'room_finished'], true);
    });
});

it('registers the call state broadcast listener', function () {
    $provider = new EventServiceProvider(app());
    $listen = (fn (): array => $this->listen)->call($provider);

    expect($listen[ConversationCallStateChanged::class])->toContain(BroadcastConversationCallStateChanged::class);
});

it('prevents non admins from starting a group call when the group requires admins only', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$member], [
        'who_can_start_call' => 'admins_only',
    ]);

    $this->actingAs($member, 'web')
        ->postJson("/api/conversations/{$conversation->id}/calls/group/voice")
        ->assertStatus(422)
        ->assertJsonPath('errors.call.0', 'Only group admins can start a call in this conversation.');
});

it('returns unauthorized when the livekit webhook signature is invalid', function () {
    $webhookService = Mockery::mock(LiveKitWebhookService::class);
    $webhookService->shouldReceive('parse')
        ->once()
        ->andThrow(new RuntimeException('Invalid signature'));

    $this->app->instance(LiveKitWebhookService::class, $webhookService);

    $this->postJson('/api/webhooks/livekit')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Invalid LiveKit webhook signature.');
});
