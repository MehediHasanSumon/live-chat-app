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

it('denies viewing a conversation to pending or removed members', function () {
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

    expect(app(ConversationPolicy::class)->view($user, $conversation))->toBeFalse();
});

it('allows only active group owners and admins to manage the group', function () {
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
        ->and($policy->manageGroup($member, $conversation))->toBeFalse();
});
