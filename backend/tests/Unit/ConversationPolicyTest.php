<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\User;
use App\Policies\ConversationPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

it('allows active members to view a conversation', function () {
    $user = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $user->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    expect(app(ConversationPolicy::class)->view($user, $conversation))->toBeTrue();
});

it('allows viewing a conversation to pending request members but denies removed members', function () {
    $user = User::factory()->create();
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'created_by' => $user->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $user->id,
        'role' => 'member',
        'membership_state' => 'request_pending',
    ]);

    expect(app(ConversationPolicy::class)->view($user, $conversation))->toBeTrue();

    ConversationMember::query()
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $user->id)
        ->update([
            'membership_state' => 'removed',
        ]);

    expect(app(ConversationPolicy::class)->view($user, $conversation))->toBeFalse();
});

it('allows active group members to manage group settings', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();

    $conversation = Conversation::query()->create([
        'type' => 'group',
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
        'user_id' => $admin->id,
        'role' => 'admin',
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

    $policy = app(ConversationPolicy::class);

    expect($policy->manageGroup($owner, $conversation))->toBeTrue()
        ->and($policy->manageGroup($admin, $conversation))->toBeTrue()
        ->and($policy->manageGroup($member, $conversation))->toBeTrue();
});
