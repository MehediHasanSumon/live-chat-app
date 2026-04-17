<?php

use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageDeleted;
use App\Events\Domain\ConversationMessageUpdated;
use App\Events\Domain\ConversationReactionChanged;
use App\Events\Domain\ConversationTypingStarted;
use App\Events\Domain\ConversationTypingStopped;
use App\Events\Domain\UserCallSignaled;
use App\Events\Domain\UserNotificationDispatched;
use App\Listeners\BroadcastConversationMessageCreated;
use App\Listeners\BroadcastConversationMessageDeleted;
use App\Listeners\BroadcastConversationMessageUpdated;
use App\Listeners\BroadcastConversationReactionChanged;
use App\Listeners\BroadcastConversationTypingStarted;
use App\Listeners\BroadcastConversationTypingStopped;
use App\Listeners\BroadcastUserCallSignal;
use App\Listeners\BroadcastUserNotification;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\User;
use App\Services\Realtime\PresenceService;
use App\Services\Realtime\TypingService;
use App\Services\Realtime\UserRealtimeSignalService;
use App\Providers\EventServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

function createRealtimeDirectConversation(User $leftUser, User $rightUser): Conversation
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

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $rightUser->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    return $conversation;
}

it('dispatches message lifecycle realtime domain events after create update and unsend', function () {
    Event::fake([
        ConversationMessageCreated::class,
        ConversationMessageUpdated::class,
        ConversationMessageDeleted::class,
    ]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createRealtimeDirectConversation($sender, $recipient);

    $createResponse = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Realtime hello',
            'client_uuid' => (string) str()->uuid(),
        ]);

    $createResponse->assertCreated();

    Event::assertDispatched(ConversationMessageCreated::class, function (ConversationMessageCreated $event) use ($conversation): bool {
        return $event->message->conversation_id === $conversation->id
            && $event->message->text_body === 'Realtime hello';
    });

    $messageId = $createResponse->json('data.id');

    $updateResponse = $this->actingAs($sender, 'web')
        ->patchJson("/api/messages/{$messageId}", [
            'text' => 'Realtime hello edited',
        ]);

    $updateResponse->assertOk();

    Event::assertDispatched(ConversationMessageUpdated::class, function (ConversationMessageUpdated $event) use ($messageId): bool {
        return $event->message->id === $messageId
            && $event->message->text_body === 'Realtime hello edited';
    });

    $deleteResponse = $this->actingAs($sender, 'web')
        ->deleteJson("/api/messages/{$messageId}", [
            'scope' => 'everyone',
        ]);

    $deleteResponse->assertOk();

    Event::assertDispatched(ConversationMessageDeleted::class, function (ConversationMessageDeleted $event) use ($messageId): bool {
        return $event->message->id === $messageId
            && $event->message->deleted_for_everyone_at !== null;
    });
});

it('dispatches reaction changed events for add and remove', function () {
    Event::fake([
        ConversationReactionChanged::class,
    ]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createRealtimeDirectConversation($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'React here',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $this->actingAs($recipient, 'web')
        ->postJson("/api/messages/{$message->id}/reactions", [
            'emoji' => 'fire',
        ])
        ->assertCreated();

    $this->actingAs($recipient, 'web')
        ->deleteJson("/api/messages/{$message->id}/reactions/fire")
        ->assertOk();

    Event::assertDispatched(ConversationReactionChanged::class, function (ConversationReactionChanged $event) use ($message): bool {
        return $event->message->id === $message->id
            && $event->action === 'added'
            && $event->emoji === 'fire';
    });

    Event::assertDispatched(ConversationReactionChanged::class, function (ConversationReactionChanged $event) use ($message): bool {
        return $event->message->id === $message->id
            && $event->action === 'removed'
            && $event->emoji === 'fire';
    });
});

it('stores a presence heartbeat using redis style keys', function () {
    $user = User::factory()->create();
    $deviceUuid = (string) str()->uuid();

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/presence/heartbeat', [
            'device_uuid' => $deviceUuid,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.presence_key', "presence:user:{$user->id}")
        ->assertJsonPath('data.ttl_seconds', PresenceService::HEARTBEAT_TTL_SECONDS)
        ->assertJsonPath('data.active_devices', 1);

    $presencePayload = Cache::get("presence:user:{$user->id}");

    expect($presencePayload)->toMatchArray([
        'user_id' => $user->id,
    ])
        ->and($presencePayload['devices'][$deviceUuid]['device_uuid'] ?? null)->toBe($deviceUuid)
        ->and($presencePayload['devices'][$deviceUuid]['updated_at'] ?? null)->not->toBeNull()
        ->and($presencePayload['devices'][$deviceUuid]['expires_at'] ?? null)->not->toBeNull();

    expect($user->fresh()->last_seen_at)->not->toBeNull();
});

it('disconnects one presence device without dropping the user offline when another device is active', function () {
    $user = User::factory()->create();
    $firstDeviceUuid = (string) str()->uuid();
    $secondDeviceUuid = (string) str()->uuid();

    $this->actingAs($user, 'web')->postJson('/api/presence/heartbeat', [
        'device_uuid' => $firstDeviceUuid,
    ])->assertOk();

    $this->actingAs($user, 'web')->postJson('/api/presence/heartbeat', [
        'device_uuid' => $secondDeviceUuid,
    ])->assertOk();

    $this->actingAs($user, 'web')
        ->postJson('/api/presence/offline', [
            'device_uuid' => $firstDeviceUuid,
        ])
        ->assertOk()
        ->assertJsonPath('data.disconnected', true)
        ->assertJsonPath('data.is_online', true)
        ->assertJsonPath('data.active_devices', 1);

    $presencePayload = Cache::get("presence:user:{$user->id}");

    expect($presencePayload)->toMatchArray([
        'user_id' => $user->id,
    ])
        ->and(array_keys($presencePayload['devices'] ?? []))->toBe([$secondDeviceUuid])
        ->and($presencePayload['devices'][$secondDeviceUuid]['device_uuid'] ?? null)->toBe($secondDeviceUuid)
        ->and($presencePayload['devices'][$secondDeviceUuid]['updated_at'] ?? null)->not->toBeNull()
        ->and($presencePayload['devices'][$secondDeviceUuid]['expires_at'] ?? null)->not->toBeNull();
});

it('marks a user offline once the last active presence device disconnects', function () {
    $user = User::factory()->create();
    $deviceUuid = (string) str()->uuid();

    $this->actingAs($user, 'web')->postJson('/api/presence/heartbeat', [
        'device_uuid' => $deviceUuid,
    ])->assertOk();

    $this->actingAs($user, 'web')
        ->postJson('/api/presence/offline', [
            'device_uuid' => $deviceUuid,
        ])
        ->assertOk()
        ->assertJsonPath('data.disconnected', true)
        ->assertJsonPath('data.is_online', false)
        ->assertJsonPath('data.active_devices', 0)
        ->assertJsonPath('data.expires_at', null);

    expect(Cache::get("presence:user:{$user->id}"))->toBeNull();
});

it('starts and stops typing while managing redis style keys', function () {
    Event::fake([
        ConversationTypingStarted::class,
        ConversationTypingStopped::class,
    ]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createRealtimeDirectConversation($sender, $recipient);
    $deviceUuid = (string) str()->uuid();
    $typingKey = "typing:conversation:{$conversation->id}:{$sender->id}";

    $startResponse = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/typing", [
            'device_uuid' => $deviceUuid,
        ]);

    $startResponse
        ->assertOk()
        ->assertJsonPath('data.typing_key', $typingKey)
        ->assertJsonPath('data.ttl_seconds', TypingService::TYPING_TTL_SECONDS);

    expect(Cache::get($typingKey))->toMatchArray([
        'conversation_id' => $conversation->id,
        'user_id' => $sender->id,
        'device_uuid' => $deviceUuid,
    ]);

    Event::assertDispatched(ConversationTypingStarted::class, function (ConversationTypingStarted $event) use ($conversation, $sender, $deviceUuid): bool {
        return $event->conversation->id === $conversation->id
            && $event->user->id === $sender->id
            && $event->deviceUuid === $deviceUuid;
    });

    $stopResponse = $this->actingAs($sender, 'web')
        ->deleteJson("/api/conversations/{$conversation->id}/typing", [
            'device_uuid' => $deviceUuid,
        ]);

    $stopResponse
        ->assertOk()
        ->assertJsonPath('data.typing_key', $typingKey)
        ->assertJsonPath('data.stopped', true);

    expect(Cache::get($typingKey))->toBeNull();

    Event::assertDispatched(ConversationTypingStopped::class, function (ConversationTypingStopped $event) use ($conversation, $sender, $deviceUuid): bool {
        return $event->conversation->id === $conversation->id
            && $event->user->id === $sender->id
            && $event->deviceUuid === $deviceUuid;
    });
});

it('dispatches user scoped notification and call signal events through the realtime service', function () {
    Event::fake([
        UserNotificationDispatched::class,
        UserCallSignaled::class,
    ]);

    $service = app(UserRealtimeSignalService::class);

    $service->dispatchNotification(11, 'notification.badge.updated', [
        'count' => 3,
    ]);

    $service->dispatchCallSignal(11, 'call.incoming', [
        'room_uuid' => 'room-123',
    ]);

    Event::assertDispatched(UserNotificationDispatched::class, function (UserNotificationDispatched $event): bool {
        return $event->userId === 11
            && $event->eventName === 'notification.badge.updated'
            && $event->payload['count'] === 3;
    });

    Event::assertDispatched(UserCallSignaled::class, function (UserCallSignaled $event): bool {
        return $event->userId === 11
            && $event->eventName === 'call.incoming'
            && $event->payload['room_uuid'] === 'room-123';
    });
});

it('registers realtime listeners for broadcast fanout', function () {
    $provider = new EventServiceProvider(app());
    $listen = (fn (): array => $this->listen)->call($provider);

    expect($listen[ConversationMessageCreated::class])->toContain(BroadcastConversationMessageCreated::class);
    expect($listen[ConversationMessageUpdated::class])->toContain(BroadcastConversationMessageUpdated::class);
    expect($listen[ConversationMessageDeleted::class])->toContain(BroadcastConversationMessageDeleted::class);
    expect($listen[ConversationReactionChanged::class])->toContain(BroadcastConversationReactionChanged::class);
    expect($listen[ConversationTypingStarted::class])->toContain(BroadcastConversationTypingStarted::class);
    expect($listen[ConversationTypingStopped::class])->toContain(BroadcastConversationTypingStopped::class);
    expect($listen[UserNotificationDispatched::class])->toContain(BroadcastUserNotification::class);
    expect($listen[UserCallSignaled::class])->toContain(BroadcastUserCallSignal::class);
});
