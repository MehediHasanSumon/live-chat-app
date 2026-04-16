<?php

use App\Events\Domain\ConversationCallStateChanged;
use App\Events\Domain\UserCallSignaled;
use App\Listeners\BroadcastConversationCallStateChanged;
use App\Models\CallRoom;
use App\Models\CallRoomParticipant;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\User;
use App\Models\UserSetting;
use App\Providers\EventServiceProvider;
use App\Services\LiveKit\LiveKitRoomService;
use App\Services\LiveKit\LiveKitTokenService;
use App\Services\LiveKit\LiveKitWebhookService;
use App\Services\Calls\CallService;
use App\Services\Realtime\PresenceService;
use Illuminate\Support\Facades\Config;
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

function callDevicePayload(array $overrides = []): array
{
    return array_merge([
        'device_ready' => true,
        'audio_input_device_id' => 'default-microphone',
        'audio_output_device_id' => 'default-speaker',
    ], $overrides);
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
    app(PresenceService::class)->heartbeat($recipient->id, 'device-online');

    $response = $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice", callDevicePayload());

    $response
        ->assertCreated()
        ->assertJsonPath('data.scope', 'direct')
        ->assertJsonPath('data.media_type', 'voice')
        ->assertJsonPath('data.max_participants', 2)
        ->assertJsonPath('data.max_video_publishers', 0);

    $roomUuid = $response->json('data.room_uuid');
    $callRoom = CallRoom::query()->where('room_uuid', $roomUuid)->firstOrFail();
    $callMessage = Message::query()->where('call_room_uuid', $roomUuid)->first();

    expect($callRoom->status)->toBe('ringing')
        ->and($callRoom->conversation->active_room_uuid)->toBe($roomUuid)
        ->and($callMessage)->not->toBeNull()
        ->and($callMessage?->type)->toBe('call')
        ->and($callMessage?->sub_type)->toBe('ringing')
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
            && $event->action === 'calling';
    });

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($roomUuid): bool {
        return $event->callRoom->room_uuid === $roomUuid
            && $event->action === 'ringing'
            && $event->callRoom->status === 'ringing';
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($recipient, $roomUuid): bool {
        return $event->userId === $recipient->id
            && $event->eventName === 'call.incoming'
            && $event->payload['call_room']['room_uuid'] === $roomUuid;
    });
});

it('keeps a direct call in calling status while the recipient is offline', function () {
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
        ->andReturn([
            'name' => 'stub-room',
        ]);

    $this->app->instance(LiveKitRoomService::class, $roomService);

    $response = $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice", callDevicePayload());

    $response
        ->assertCreated()
        ->assertJsonPath('data.status', 'calling');

    $roomUuid = $response->json('data.room_uuid');

    expect(
        CallRoomParticipant::query()
            ->whereHas('callRoom', fn ($query) => $query->where('room_uuid', $roomUuid))
            ->where('user_id', $recipient->id)
            ->value('invite_status')
    )->toBe('invited');

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($roomUuid): bool {
        return $event->callRoom->room_uuid === $roomUuid
            && $event->action === 'calling';
    });

    Event::assertNotDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($roomUuid): bool {
        return $event->callRoom->room_uuid === $roomUuid
            && $event->action === 'ringing';
    });
});

it('moves a call into connecting on accept and stores the call duration when it ends', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $caller->id,
        'active_room_uuid' => (string) str()->uuid(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $caller->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => $conversation->active_room_uuid,
        'conversation_id' => $conversation->id,
        'scope' => 'direct',
        'media_type' => 'voice',
        'created_by' => $caller->id,
        'status' => 'ringing',
        'max_participants' => 2,
        'max_video_publishers' => 0,
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $caller->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(150),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'ringing',
    ]);

    $acceptResponse = $this->actingAs($recipient, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/accept", callDevicePayload());

    $acceptResponse
        ->assertOk()
        ->assertJsonPath('data.status', 'connecting')
        ->assertJsonPath('data.started_at', null);

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

    $callRoom->refresh();
    $callRoom->forceFill([
        'started_at' => now()->subSeconds(125),
    ])->save();

    $endResponse = $this->actingAs($caller, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/end", [
            'reason' => 'ended_by_participant',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'ended');

    expect((int) $endResponse->json('data.duration_seconds'))
        ->toBeGreaterThanOrEqual(125)
        ->toBeLessThanOrEqual(126);

    expect($callRoom->fresh()->status)->toBe('ended')
        ->and((int) $callRoom->fresh()->duration_seconds)->toBeGreaterThanOrEqual(125)
        ->and((int) $callRoom->fresh()->duration_seconds)->toBeLessThanOrEqual(126)
        ->and(Message::query()->where('call_room_uuid', $callRoom->room_uuid)->value('sub_type'))->toBe('ended')
        ->and($conversation->fresh()->active_room_uuid)->toBeNull();
});

it('lets a participant leave an active group call without ending it for everyone else', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'video',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(75),
        'max_participants' => 3,
        'max_video_publishers' => 2,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $owner->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(75),
        'is_video_publisher' => true,
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberA->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(70),
        'is_video_publisher' => true,
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberB->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(65),
    ]);

    $this->actingAs($memberA, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/end", [
            'reason' => 'left_from_web_room',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'active');

    expect($callRoom->fresh()->status)->toBe('active')
        ->and($callRoom->fresh()->ended_at)->toBeNull()
        ->and($conversation->fresh()->active_room_uuid)->toBe($callRoom->room_uuid)
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberA->id)
                ->value('invite_status')
        )->toBe('left')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberA->id)
                ->value('is_video_publisher')
        )->toBeFalse()
        ->and(Message::query()->where('call_room_uuid', $callRoom->room_uuid)->value('sub_type'))->toBe('in_call');
});

it('lets the group call creator end a call for everyone', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(42),
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $memberA, $memberB] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(40),
        ]);
    }

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/end-for-all", [
            'reason' => 'ended_by_host',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'ended')
        ->assertJsonPath('data.ended_reason', 'ended_by_host');

    expect($callRoom->fresh()->status)->toBe('ended')
        ->and($callRoom->fresh()->ended_reason)->toBe('ended_by_host')
        ->and($conversation->fresh()->active_room_uuid)->toBeNull()
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('invite_status', 'left')
                ->count()
        )->toBe(3)
        ->and(Message::query()->where('call_room_uuid', $callRoom->room_uuid)->value('sub_type'))->toBe('ended');
});

it('prevents non-admin participants from ending a group call for everyone', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $otherMember = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$member, $otherMember]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'video',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(18),
        'max_participants' => 3,
        'max_video_publishers' => 2,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $member, $otherMember] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(15),
        ]);
    }

    $this->actingAs($member, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/end-for-all", [
            'reason' => 'not_allowed',
        ])
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not allowed to end this call for everyone.');

    expect($callRoom->fresh()->status)->toBe('active')
        ->and($conversation->fresh()->active_room_uuid)->toBe($callRoom->room_uuid);
});

it('lets group call managers lock and unlock a room', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$admin, $member]);

    ConversationMember::query()
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $admin->id)
        ->update([
            'role' => 'admin',
        ]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'ringing',
        'is_locked' => false,
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $owner->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(12),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $admin->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(10),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $member->id,
        'invite_status' => 'ringing',
    ]);

    $this->actingAs($admin, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/lock")
        ->assertOk()
        ->assertJsonPath('data.is_locked', true);

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/unlock")
        ->assertOk()
        ->assertJsonPath('data.is_locked', false);

    expect($callRoom->fresh()->is_locked)->toBeFalse()
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $member->id)
                ->value('invite_status')
        )->toBe('ringing');
});

it('prevents regular group members from locking an active call room', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$member]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'video',
        'created_by' => $owner->id,
        'status' => 'active',
        'is_locked' => false,
        'started_at' => now()->subSeconds(20),
        'max_participants' => 2,
        'max_video_publishers' => 1,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $member] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(18),
        ]);
    }

    $this->actingAs($member, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/lock")
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not allowed to manage this call.');

    expect($callRoom->fresh()->is_locked)->toBeFalse();
});

it('lets group call managers remove another participant from an active room', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'video',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(48),
        'is_locked' => false,
        'max_participants' => 3,
        'max_video_publishers' => 2,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $owner->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(48),
        'is_video_publisher' => true,
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberA->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(42),
        'is_video_publisher' => true,
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberB->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(40),
    ]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('removeParticipant')
        ->once()
        ->with($callRoom->room_uuid, (string) $memberA->id)
        ->andReturnTrue();
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/participants/{$memberA->id}/remove", [
            'reason' => 'removed_by_host',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'active');

    expect($callRoom->fresh()->status)->toBe('active')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberA->id)
                ->value('invite_status')
        )->toBe('kicked')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberA->id)
                ->value('left_reason')
        )->toBe('removed_by_host')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberA->id)
                ->value('is_video_publisher')
        )->toBeFalse();
});

it('prevents regular group members from removing participants from an active room', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(12),
        'is_locked' => false,
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $memberA, $memberB] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(10),
        ]);
    }

    $this->actingAs($memberA, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/participants/{$memberB->id}/remove")
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not allowed to manage this call.');

    expect(
        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->where('user_id', $memberB->id)
            ->value('invite_status')
    )->toBe('accepted');
});

it('lets group call managers request mute-all for accepted participants', function () {
    Event::fake([
        UserCallSignaled::class,
    ]);

    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(20),
        'is_locked' => false,
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $memberA, $memberB] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(18),
        ]);
    }

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/mute-all")
        ->assertOk()
        ->assertJsonPath('data.room_uuid', $callRoom->room_uuid);

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($callRoom, $memberA): bool {
        return $event->userId === $memberA->id
            && $event->eventName === 'call.mute.requested'
            && $event->payload['room_uuid'] === $callRoom->room_uuid;
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($callRoom, $memberB): bool {
        return $event->userId === $memberB->id
            && $event->eventName === 'call.mute.requested'
            && $event->payload['room_uuid'] === $callRoom->room_uuid;
    });
});

it('prevents regular group members from requesting mute-all', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $otherMember = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$member, $otherMember]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(10),
        'is_locked' => false,
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    foreach ([$owner, $member, $otherMember] as $participantUser) {
        CallRoomParticipant::query()->create([
            'call_room_id' => $callRoom->id,
            'user_id' => $participantUser->id,
            'invite_status' => 'accepted',
            'joined_at' => now()->subSeconds(9),
        ]);
    }

    $this->actingAs($member, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/mute-all")
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not allowed to manage this call.');
});

it('lets group call managers invite more members into an active room', function () {
    Event::fake([
        UserCallSignaled::class,
        ConversationCallStateChanged::class,
    ]);

    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $memberC = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $memberC->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(20),
        'is_locked' => false,
        'max_participants' => 4,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $owner->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(20),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberA->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(18),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberB->id,
        'invite_status' => 'left',
        'left_at' => now()->subSeconds(4),
        'left_reason' => 'network_drop',
    ]);

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/invite", [
            'user_ids' => [$memberB->id, $memberC->id],
        ])
        ->assertOk()
        ->assertJsonPath('data.room_uuid', $callRoom->room_uuid);

    expect(
        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->where('user_id', $memberB->id)
            ->value('invite_status')
    )->toBe('ringing')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $memberC->id)
                ->value('invite_status')
        )->toBe('ringing');

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($callRoom, $memberB): bool {
        return $event->userId === $memberB->id
            && $event->eventName === 'call.incoming'
            && $event->payload['call_room']['room_uuid'] === $callRoom->room_uuid;
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($callRoom, $memberC): bool {
        return $event->userId === $memberC->id
            && $event->eventName === 'call.incoming'
            && $event->payload['call_room']['room_uuid'] === $callRoom->room_uuid;
    });
});

it('prevents inviting more members when the room is locked', function () {
    $owner = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();
    $conversation = createCallGroupConversation($owner, [$memberA, $memberB]);

    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $owner->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(10),
        'is_locked' => true,
        'max_participants' => 4,
        'max_video_publishers' => 0,
    ]);

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $owner->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(10),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $memberA->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(8),
    ]);

    $this->actingAs($owner, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/invite", [
            'user_ids' => [$memberB->id],
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.call.0', 'Unlock the room before inviting more members.');
});

it('keeps declined calls in the database with a terminal status', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $caller->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $caller->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

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

    $callRoom->forceFill([
        'created_at' => now()->subSeconds(22),
        'updated_at' => now()->subSeconds(22),
    ])->save();

    $conversation->forceFill([
        'active_room_uuid' => $callRoom->room_uuid,
    ])->save();

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $caller->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(20),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'ringing',
    ]);

    $this->actingAs($recipient, 'web')
        ->postJson("/api/calls/{$callRoom->room_uuid}/decline")
        ->assertOk()
        ->assertJsonPath('data.status', 'declined')
        ->assertJsonPath('data.duration_seconds', 0);

    $callMessage = Message::query()->where('call_room_uuid', $callRoom->room_uuid)->first();

    expect(CallRoom::query()->whereKey($callRoom->id)->exists())->toBeTrue()
        ->and($callRoom->fresh()->status)->toBe('declined')
        ->and($callMessage?->sub_type)->toBe('declined')
        ->and($callRoom->fresh()->ended_reason)->toBe('all_declined')
        ->and($callMessage?->metadata_json['declined_by'] ?? null)->toBe([$recipient->name])
        ->and($callMessage?->metadata_json['accepted_by'] ?? null)->toBe([$caller->name])
        ->and(($callMessage?->metadata_json['ring_duration_seconds'] ?? 0) >= 22)->toBeTrue();
});

it('shows an active call room to participants', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $caller->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $caller->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

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

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $caller->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(20),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'ringing',
    ]);

    $this->actingAs($caller, 'web')
        ->getJson("/api/calls/{$callRoom->room_uuid}")
        ->assertOk()
        ->assertJsonPath('data.room_uuid', $callRoom->room_uuid)
        ->assertJsonCount(2, 'data.participants');
});

it('does not show a call room to users outside the conversation', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $outsider = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $caller->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $caller->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

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

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $caller->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(20),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'ringing',
    ]);

    $this->actingAs($outsider, 'web')
        ->getJson("/api/calls/{$callRoom->room_uuid}")
        ->assertNotFound();
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
        ->postJson("/api/conversations/{$conversation->id}/calls/group/video", callDevicePayload());

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
        'joined_at' => now()->subSeconds(20),
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
        ->and($callRoom->fresh()->duration_seconds)->toBeGreaterThanOrEqual(0)
        ->and($conversation->fresh()->active_room_uuid)->toBeNull();

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($callRoom): bool {
        return $event->callRoom->room_uuid === $callRoom->room_uuid
            && in_array($event->action, ['in_call', 'ended'], true);
    });
});

it('keeps an active direct call resumable after an unexpected participant disconnect', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createCallGroupConversation($caller, [$recipient]);
    $callRoom = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'direct',
        'media_type' => 'voice',
        'created_by' => $caller->id,
        'status' => 'active',
        'started_at' => now()->subSeconds(25),
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
        'joined_at' => now()->subSeconds(25),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $callRoom->id,
        'user_id' => $recipient->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subSeconds(22),
    ]);

    $webhookService = Mockery::mock(LiveKitWebhookService::class);
    $webhookService->shouldReceive('parse')
        ->once()
        ->andReturn([
            'event' => 'participant_left',
            'room' => ['name' => $callRoom->room_uuid],
            'participant' => [
                'identity' => (string) $recipient->id,
                'disconnect_reason' => 'client_closed',
            ],
        ]);

    $this->app->instance(LiveKitWebhookService::class, $webhookService);

    $this->postJson('/api/webhooks/livekit')
        ->assertOk()
        ->assertJsonPath('event', 'participant_left')
        ->assertJsonPath('call_room', $callRoom->room_uuid);

    expect($callRoom->fresh()->status)->toBe('connecting')
        ->and($callRoom->fresh()->ended_at)->toBeNull()
        ->and($conversation->fresh()->active_room_uuid)->toBe($callRoom->room_uuid)
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $recipient->id)
                ->value('invite_status')
        )->toBe('accepted')
        ->and(
            CallRoomParticipant::query()
                ->where('call_room_id', $callRoom->id)
                ->where('user_id', $recipient->id)
                ->value('left_at')
        )->not->toBeNull();
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
        ->postJson("/api/conversations/{$conversation->id}/calls/group/voice", callDevicePayload())
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

it('does not expose generic livekit token or room management endpoints to authenticated users', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->postJson('/api/livekit/token', [
            'room' => 'private-room',
        ])
        ->assertNotFound();

    $this->actingAs($user, 'web')
        ->postJson('/api/livekit/rooms', [
            'room' => 'private-room',
        ])
        ->assertNotFound();

    $this->actingAs($user, 'web')
        ->getJson('/api/livekit/rooms')
        ->assertNotFound();
});

it('cleans up stale ringing calls and marks them as missed', function () {
    Event::fake([
        ConversationCallStateChanged::class,
        UserCallSignaled::class,
    ]);

    Config::set('calls.ringing_timeout_seconds', 30);

    $caller = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $caller->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $caller->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

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

    $callRoom->forceFill([
        'created_at' => now()->subMinutes(2),
        'updated_at' => now()->subSeconds(40),
    ])->save();

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
        'invite_status' => 'ringing',
    ]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('deleteRoom')
        ->once()
        ->with($callRoom->room_uuid)
        ->andReturnTrue();
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $this->artisan('calls:cleanup-stale')
        ->expectsOutput('Cleaned up 1 stale calls.')
        ->assertSuccessful();

    expect($callRoom->fresh()->status)->toBe('missed')
        ->and($callRoom->fresh()->ended_reason)->toBe('ring_timeout')
        ->and($conversation->fresh()->active_room_uuid)->toBeNull()
        ->and(Message::query()->where('call_room_uuid', $callRoom->room_uuid)->value('sub_type'))->toBe('missed');

    Event::assertDispatched(ConversationCallStateChanged::class, function (ConversationCallStateChanged $event) use ($callRoom): bool {
        return $event->callRoom->room_uuid === $callRoom->room_uuid
            && $event->action === 'missed';
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event) use ($callRoom): bool {
        return $event->eventName === 'call.state.changed'
            && $event->payload['action'] === 'missed'
            && $event->payload['call_room']['room_uuid'] === $callRoom->room_uuid;
    });
});
