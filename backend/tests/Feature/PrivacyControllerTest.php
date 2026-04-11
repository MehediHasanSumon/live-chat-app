<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserRestriction;
use App\Models\UserSetting;
use App\Services\Conversations\ConversationService;
use App\Services\Realtime\PresenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createPrivacyDirectConversation(User $leftUser, User $rightUser): Conversation
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

it('creates message requests for new direct conversations and lets the recipient accept them', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $conversationId = app(ConversationService::class)
        ->getOrCreateDirect($sender->id, $recipient->id)
        ->id;

    expect(
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $recipient->id)
            ->value('membership_state')
    )->toBe('request_pending');

    $this->actingAs($recipient, 'web')
        ->getJson('/api/message-requests')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $conversationId)
        ->assertJsonPath('data.0.membership.membership_state', 'request_pending');

    $this->actingAs($recipient, 'web')
        ->postJson("/api/message-requests/{$conversationId}/accept")
        ->assertOk()
        ->assertJsonPath('data.membership.membership_state', 'active');

    expect(
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $recipient->id)
            ->value('membership_state')
    )->toBe('active');
});

it('lets the recipient reject a message request', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $conversationId = app(ConversationService::class)
        ->getOrCreateDirect($sender->id, $recipient->id)
        ->id;

    $this->actingAs($recipient, 'web')
        ->postJson("/api/message-requests/{$conversationId}/reject")
        ->assertOk()
        ->assertJsonPath('data.membership.membership_state', 'removed');

    expect(
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $recipient->id)
            ->value('membership_state')
    )->toBe('removed');
});

it('blocks and restricts users through the privacy endpoints', function () {
    $actor = User::factory()->create();
    $target = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson("/api/users/{$target->id}/block")
        ->assertCreated()
        ->assertJsonPath('data.blocked_user_id', $target->id);

    expect(UserBlock::query()
        ->where('blocker_user_id', $actor->id)
        ->where('blocked_user_id', $target->id)
        ->exists())->toBeTrue();

    $this->actingAs($actor, 'web')
        ->deleteJson("/api/users/{$target->id}/block")
        ->assertOk()
        ->assertJsonPath('data.deleted', true);

    $this->actingAs($actor, 'web')
        ->postJson("/api/users/{$target->id}/restrict")
        ->assertCreated()
        ->assertJsonPath('data.target_user_id', $target->id);

    expect(UserRestriction::query()
        ->where('owner_user_id', $actor->id)
        ->where('target_user_id', $target->id)
        ->exists())->toBeTrue();

    $this->actingAs($actor, 'web')
        ->deleteJson("/api/users/{$target->id}/restrict")
        ->assertOk()
        ->assertJsonPath('data.deleted', true);
});

it('lists blocked accounts for the current user', function () {
    $actor = User::factory()->create();
    $firstTarget = User::factory()->create([
        'name' => 'Blocked One',
        'username' => 'blocked_one',
    ]);
    $secondTarget = User::factory()->create([
        'name' => 'Blocked Two',
        'username' => 'blocked_two',
    ]);

    UserBlock::query()->create([
        'blocker_user_id' => $actor->id,
        'blocked_user_id' => $firstTarget->id,
        'block_chat' => true,
        'block_call' => true,
        'hide_presence' => true,
        'created_at' => now()->subMinute(),
    ]);

    UserBlock::query()->create([
        'blocker_user_id' => $actor->id,
        'blocked_user_id' => $secondTarget->id,
        'block_chat' => true,
        'block_call' => true,
        'hide_presence' => true,
        'created_at' => now(),
    ]);

    $this->actingAs($actor, 'web')
        ->getJson('/api/blocked-users')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.blocked_user_id', $secondTarget->id)
        ->assertJsonPath('data.0.blocked_user.id', $secondTarget->id)
        ->assertJsonPath('data.0.blocked_user.username', 'blocked_two')
        ->assertJsonPath('data.1.blocked_user_id', $firstTarget->id)
        ->assertJsonPath('data.1.blocked_user.username', 'blocked_one');
});

it('prevents sending messages when chat is blocked', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createPrivacyDirectConversation($sender, $recipient);

    UserBlock::query()->create([
        'blocker_user_id' => $recipient->id,
        'blocked_user_id' => $sender->id,
        'block_chat' => true,
        'block_call' => false,
        'hide_presence' => false,
    ]);

    $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'This should fail',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.text.0', 'Messaging is blocked for this conversation.');
});

it('prevents direct calls until the message request is accepted', function () {
    $caller = User::factory()->create();
    $recipient = User::factory()->create();

    $this->actingAs($caller, 'web')
        ->postJson("/api/calls/direct/{$recipient->id}/voice")
        ->assertStatus(422)
        ->assertJsonPath('errors.call.0', 'Calls are only allowed after the message request is accepted.');
});

it('hides presence when the target disables active status visibility', function () {
    $viewer = User::factory()->create();
    $target = User::factory()->create([
        'last_seen_at' => now()->subMinute(),
    ]);

    UserSetting::query()->create([
        'user_id' => $target->id,
        'show_active_status' => false,
        'allow_message_requests' => true,
        'push_enabled' => true,
        'sound_enabled' => true,
        'vibrate_enabled' => true,
        'quiet_hours_enabled' => false,
        'theme' => 'system',
        'updated_at' => now(),
    ]);

    app(PresenceService::class)->heartbeat($target->id, 'device-1');

    $this->actingAs($viewer, 'web')
        ->getJson("/api/users/{$target->id}/presence")
        ->assertOk()
        ->assertJsonPath('data.user_id', $target->id)
        ->assertJsonPath('data.visible', false)
        ->assertJsonPath('data.is_online', false)
        ->assertJsonPath('data.last_seen_at', null);
});
