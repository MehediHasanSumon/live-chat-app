<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\CallRoom;
use App\Models\CallRoomParticipant;
use App\Models\NotificationOutbox;
use App\Models\User;
use App\Models\UserRestriction;
use App\Models\UserSetting;
use App\Services\LiveKit\LiveKitRoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createNotificationConversation(User $leftUser, User $rightUser, array $membershipOverrides = []): Conversation
{
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'direct_key' => hash('sha256', implode(':', collect([$leftUser->id, $rightUser->id])->sort()->values()->all())),
        'created_by' => $leftUser->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $leftUser->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create(array_merge([
        'conversation_id' => $conversation->id,
        'user_id' => $rightUser->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
        'notifications_mode' => 'all',
    ], $membershipOverrides));

    return $conversation;
}

it('creates and delivers an outbox notification for a new message', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createNotificationConversation($sender, $recipient);

    $response = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Notification hello',
            'client_uuid' => (string) str()->uuid(),
        ]);

    $response->assertCreated();

    $notification = NotificationOutbox::query()->firstOrFail();

    expect($notification->user_id)->toBe($recipient->id)
        ->and($notification->type)->toBe('new_message')
        ->and($notification->status)->toBe('sent')
        ->and($notification->conversation_id)->toBe($conversation->id)
        ->and($notification->sent_at)->not->toBeNull();
});

it('suppresses immediate notifications for muted or restricted recipients', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createNotificationConversation($sender, $recipient, [
        'notifications_mode' => 'mute',
    ]);

    UserRestriction::query()->create([
        'owner_user_id' => $recipient->id,
        'target_user_id' => $sender->id,
        'move_to_requests' => false,
        'mute_notifications' => true,
        'prevent_calling' => false,
        'created_at' => now(),
    ]);

    $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Muted hello',
            'client_uuid' => (string) str()->uuid(),
        ])
        ->assertCreated();

    $notification = NotificationOutbox::query()->firstOrFail();

    expect($notification->status)->toBe('suppressed')
        ->and($notification->failure_reason)->toBe('muted_or_restricted')
        ->and($notification->sent_at)->toBeNull();
});

it('queues scheduled digest notifications and dispatches them when due', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createNotificationConversation($sender, $recipient, [
        'notifications_mode' => 'scheduled',
        'notification_schedule_json' => [
            'hour' => now()->addMinute()->hour,
            'minute' => now()->addMinute()->minute,
            'timezone' => config('app.timezone'),
        ],
    ]);

    $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Digest hello',
            'client_uuid' => (string) str()->uuid(),
        ])
        ->assertCreated();

    $notification = NotificationOutbox::query()->firstOrFail();

    expect($notification->type)->toBe('summary')
        ->and($notification->status)->toBe('queued')
        ->and($notification->schedule_at)->not->toBeNull()
        ->and($notification->sent_at)->toBeNull();

    $notification->forceFill([
        'schedule_at' => now()->subMinute(),
    ])->save();

    $this->artisan('chat:dispatch-scheduled-digests')
        ->expectsOutputToContain('Dispatched 1 scheduled digest notifications.')
        ->assertSuccessful();

    expect($notification->fresh()->status)->toBe('sent')
        ->and($notification->fresh()->sent_at)->not->toBeNull();
});

it('produces call invite outbox notifications when a call starts', function () {
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
    $roomService->shouldReceive('createRoom')->once()->andReturn(['name' => 'stub-room']);
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice")
        ->assertCreated();

    $notification = NotificationOutbox::query()
        ->where('type', 'call_invite')
        ->firstOrFail();

    expect($notification->user_id)->toBe($recipient->id)
        ->and($notification->status)->toBe('sent')
        ->and($notification->sent_at)->not->toBeNull();
});

it('marks call invites as silent when notification sound is disabled', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();

    UserSetting::query()->create([
        'user_id' => $recipient->id,
        'show_active_status' => true,
        'allow_message_requests' => false,
        'push_enabled' => true,
        'sound_enabled' => false,
        'vibrate_enabled' => true,
        'quiet_hours_enabled' => false,
        'theme' => 'system',
        'updated_at' => now(),
    ]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('createRoom')->once()->andReturn(['name' => 'stub-room']);
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice")
        ->assertCreated();

    $notification = NotificationOutbox::query()
        ->where('type', 'call_invite')
        ->latest('id')
        ->firstOrFail();

    expect($notification->status)->toBe('sent')
        ->and($notification->payload_json['silent'] ?? null)->toBeTrue()
        ->and($notification->payload_json['can_accept'] ?? null)->toBeTrue();
});

it('marks call invites as busy when the recipient is already in another active call', function () {
    $busyCaller = User::factory()->create();
    $newCaller = User::factory()->create();
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

    $busyConversation = createNotificationConversation($busyCaller, $recipient);

    $existingCall = CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $busyConversation->id,
        'scope' => 'direct',
        'media_type' => 'voice',
        'created_by' => $busyCaller->id,
        'status' => 'active',
        'max_participants' => 2,
        'max_video_publishers' => 0,
        'started_at' => now()->subMinutes(1),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $existingCall->id,
        'user_id' => $busyCaller->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subMinutes(1),
    ]);

    CallRoomParticipant::query()->create([
        'call_room_id' => $existingCall->id,
        'user_id' => $recipient->id,
        'invite_status' => 'accepted',
        'joined_at' => now()->subMinutes(1),
    ]);

    $roomService = Mockery::mock(LiveKitRoomService::class);
    $roomService->shouldReceive('createRoom')->once()->andReturn(['name' => 'stub-room']);
    $this->app->instance(LiveKitRoomService::class, $roomService);

    $this->actingAs($newCaller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice")
        ->assertCreated();

    $notification = NotificationOutbox::query()
        ->where('type', 'call_invite')
        ->latest('id')
        ->firstOrFail();

    expect($notification->status)->toBe('sent')
        ->and($notification->payload_json['busy'] ?? null)->toBeTrue();
});
