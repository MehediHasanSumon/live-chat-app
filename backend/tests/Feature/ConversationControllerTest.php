<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\StorageObject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

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

it('allows a user to archive pin mute and manage conversation read state', function () {
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

    $this->actingAs($creator, 'web')
        ->postJson("/api/conversations/{$conversation->id}/unread")
        ->assertOk()
        ->assertJsonPath('data.membership.last_read_seq', 13)
        ->assertJsonPath('data.membership.unread_count_cache', 1)
        ->assertJsonPath('data.membership.archived_at', null);
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
        'owner_user_id' => $owner->id,
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
        ->assertJsonPath('data.avatar_object_id', $avatar->id)
        ->assertJsonPath('data.avatar_object.id', $avatar->id);
});

it('rejects group avatar updates that use another users upload', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $avatar = StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'owner_user_id' => $otherUser->id,
        'purpose' => 'group_avatar',
        'media_kind' => 'image',
        'storage_driver' => 'local',
        'disk_path' => 'avatars/foreign-group.png',
        'original_name' => 'foreign-group.png',
        'mime_type' => 'image/png',
        'size_bytes' => 2048,
    ]);

    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Ops squad',
        'created_by' => $owner->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    $this->actingAs($owner, 'web')
        ->patchJson("/api/groups/{$conversation->id}", [
            'avatar_object_id' => $avatar->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.avatar_object_id.0', 'You may only use group avatars that you uploaded.');
});

it('allows group admins to save a new avatar file and title in one request', function () {
    Storage::fake(config('uploads.disk'));

    $owner = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Design team',
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
        ->patch("/api/groups/{$conversation->id}", [
            'title' => 'Design team v2',
            'avatar_file' => UploadedFile::fake()->image('group-avatar.png', 160, 160),
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.title', 'Design team v2')
        ->assertJsonPath('data.avatar_object.purpose', 'group_avatar')
        ->assertJsonPath('data.avatar_object.owner_user_id', $owner->id);
});

it('forbids showing a conversation to a pending member', function () {
    $owner = User::factory()->create();
    $pendingUser = User::factory()->create();

    $conversation = Conversation::query()->create([
        'type' => 'direct',
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
        'user_id' => $pendingUser->id,
        'role' => 'member',
        'membership_state' => 'request_pending',
    ]);

    $this->actingAs($pendingUser, 'web')
        ->getJson("/api/conversations/{$conversation->id}")
        ->assertForbidden();
});
