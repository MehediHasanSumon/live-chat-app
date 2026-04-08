<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\StorageObject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates or returns a direct conversation for two users', function () {
    $authUser = User::factory()->create();
    $targetUser = User::factory()->create();

    $response = $this
        ->actingAs($authUser, 'web')
        ->postJson('/api/conversations/direct', [
            'target_user_id' => $targetUser->id,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.type', 'direct');

    $conversationId = $response->json('data.id');

    expect(Conversation::query()->count())->toBe(1)
        ->and(ConversationMember::query()->where('conversation_id', $conversationId)->count())->toBe(2);

    $secondResponse = $this
        ->actingAs($authUser, 'web')
        ->postJson('/api/conversations/direct', [
            'target_user_id' => $targetUser->id,
        ]);

    $secondResponse
        ->assertCreated()
        ->assertJsonPath('data.id', $conversationId);

    expect(Conversation::query()->count())->toBe(1);
});

it('creates a group and assigns the creator as owner', function () {
    $creator = User::factory()->create();
    $memberA = User::factory()->create();
    $memberB = User::factory()->create();

    $response = $this
        ->actingAs($creator, 'web')
        ->postJson('/api/groups', [
            'title' => 'Launch team',
            'description' => 'Core launch planning',
            'member_ids' => [$memberA->id, $memberB->id],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.type', 'group')
        ->assertJsonPath('data.title', 'Launch team');

    $conversationId = $response->json('data.id');

    expect(
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $creator->id)
            ->value('role')
    )->toBe('owner');
});

it('allows a user to archive pin mute and mark a conversation as read', function () {
    $creator = User::factory()->create();
    $target = User::factory()->create();

    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'direct_key' => hash('sha256', implode(':', [$creator->id, $target->id])),
        'created_by' => $creator->id,
        'last_message_seq' => 14,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $creator->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $target->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
        'unread_count_cache' => 4,
    ]);

    $this->actingAs($creator, 'web')
        ->patchJson("/api/conversations/{$conversation->id}/archive")
        ->assertOk()
        ->assertJsonPath('data.membership.archived_at', fn ($value) => $value !== null);

    $this->actingAs($creator, 'web')
        ->patchJson("/api/conversations/{$conversation->id}/pin")
        ->assertOk()
        ->assertJsonPath('data.membership.pinned_at', fn ($value) => $value !== null);

    $this->actingAs($creator, 'web')
        ->patchJson("/api/conversations/{$conversation->id}/mute", [
            'muted_until' => now()->addHour()->toIso8601String(),
        ])
        ->assertOk()
        ->assertJsonPath('data.membership.muted_until', fn ($value) => $value !== null);

    $this->actingAs($creator, 'web')
        ->postJson("/api/conversations/{$conversation->id}/read", [
            'last_seq' => 14,
        ])
        ->assertOk()
        ->assertJsonPath('data.membership.last_read_seq', 14)
        ->assertJsonPath('data.membership.unread_count_cache', 0);
});

it('prevents non group admins from updating group details', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();

    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Writers room',
        'created_by' => $owner->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $member->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    $this->actingAs($member, 'web')
        ->patchJson("/api/groups/{$conversation->id}", [
            'title' => 'Updated title',
        ])
        ->assertForbidden();
});

it('allows group admins to rename a group and update its avatar', function () {
    $owner = User::factory()->create();
    $avatar = StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'purpose' => 'group_avatar',
        'media_kind' => 'image',
        'storage_driver' => 'local',
        'disk_path' => 'avatars/group.png',
        'original_name' => 'group.png',
        'mime_type' => 'image/png',
        'size_bytes' => 2048,
    ]);

    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Product circle',
        'created_by' => $owner->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    $response = $this->actingAs($owner, 'web')
        ->patchJson("/api/groups/{$conversation->id}", [
            'title' => 'Product circle v2',
            'avatar_object_id' => $avatar->id,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.title', 'Product circle v2')
        ->assertJsonPath('data.avatar_object_id', $avatar->id);
});
