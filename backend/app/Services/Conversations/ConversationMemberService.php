<?php

namespace App\Services\Conversations;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ConversationMemberService
{
    public function requireReadableMembership(Conversation $conversation, int $userId): ConversationMember
    {
        return $conversation->members()
            ->where('user_id', $userId)
            ->whereIn('membership_state', ['active', 'request_pending'])
            ->firstOrFail();
    }

    public function requireActiveMembership(Conversation $conversation, int $userId): ConversationMember
    {
        return $conversation->members()
            ->where('user_id', $userId)
            ->where('membership_state', 'active')
            ->firstOrFail();
    }

    /**
     * @throws AuthorizationException
     */
    public function ensureGroupManager(Conversation $conversation, int $userId): ConversationMember
    {
        $membership = $this->requireActiveMembership($conversation, $userId);

        if ($conversation->type !== 'group' || ! in_array($membership->role, ['owner', 'admin'], true)) {
            throw new AuthorizationException('You are not allowed to manage this group.');
        }

        return $membership;
    }

    public function addMembers(Conversation $conversation, array $memberIds, int $actorId): Conversation
    {
        $this->ensureGroupManager($conversation, $actorId);
        $normalizedMemberIds = collect($memberIds)
            ->map(static fn ($value) => (int) $value)
            ->filter(static fn ($value) => $value > 0)
            ->unique()
            ->reject(static fn ($value) => $value === $actorId)
            ->values();

        if ($normalizedMemberIds->isEmpty()) {
            throw new InvalidArgumentException('Select at least one user to add.');
        }

        return DB::transaction(function () use ($actorId, $conversation, $normalizedMemberIds): Conversation {
            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $existingCount = ConversationMember::query()
                ->where('conversation_id', $lockedConversation->getKey())
                ->whereIn('membership_state', ['active', 'invited', 'request_pending'])
                ->count();

            if ($existingCount + $normalizedMemberIds->count() > 12) {
                throw new InvalidArgumentException('A group may include at most 12 members.');
            }

            User::query()->whereIn('id', $normalizedMemberIds)->get()->each(function (User $user) use ($actorId, $lockedConversation): void {
                ConversationMember::query()->updateOrCreate([
                    'conversation_id' => $lockedConversation->getKey(),
                    'user_id' => $user->getKey(),
                ], [
                    'role' => 'member',
                    'membership_state' => 'active',
                    'added_by_user_id' => $actorId,
                    'joined_at' => now(),
                    'left_at' => null,
                    'removed_at' => null,
                    'request_created_at' => null,
                ]);
            });

            return $lockedConversation->fresh([
                'creator.avatarObject',
                'avatarObject',
                'lastMessage.sender.avatarObject',
                'members.user.avatarObject',
            ]);
        });
    }

    public function removeMember(Conversation $conversation, int $memberId, int $actorId): Conversation
    {
        $actorMembership = $this->ensureGroupManager($conversation, $actorId);

        return DB::transaction(function () use ($actorMembership, $conversation, $memberId): Conversation {
            $membership = ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('user_id', $memberId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($membership->role === 'owner') {
                throw new InvalidArgumentException('The group owner cannot be removed.');
            }

            if ($actorMembership->role !== 'owner' && $membership->role === 'admin') {
                throw new InvalidArgumentException('Only the owner can remove another admin.');
            }

            $membership->forceFill([
                'membership_state' => 'removed',
                'removed_at' => now(),
            ])->save();

            return $conversation->fresh([
                'creator.avatarObject',
                'avatarObject',
                'lastMessage.sender.avatarObject',
                'members.user.avatarObject',
            ]);
        });
    }

    public function leaveGroup(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->requireActiveMembership($conversation, $userId);

        if ($conversation->type !== 'group') {
            throw new InvalidArgumentException('Only group members can leave a conversation.');
        }

        if ($membership->role === 'owner') {
            $otherActiveCount = ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('user_id', '!=', $userId)
                ->where('membership_state', 'active')
                ->count();

            if ($otherActiveCount > 0) {
                throw new InvalidArgumentException('Transfer ownership before leaving the group.');
            }
        }

        $membership->forceFill([
            'membership_state' => 'left',
            'left_at' => now(),
        ])->save();

        return $conversation->fresh([
            'creator.avatarObject',
            'avatarObject',
            'lastMessage.sender.avatarObject',
            'members.user.avatarObject',
        ]);
    }

    public function changeRole(Conversation $conversation, int $memberId, string $role, int $actorId): Conversation
    {
        $actorMembership = $this->ensureGroupManager($conversation, $actorId);

        return DB::transaction(function () use ($actorMembership, $conversation, $memberId, $role): Conversation {
            $membership = ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('user_id', $memberId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($membership->role === 'owner') {
                throw new InvalidArgumentException('The group owner role cannot be changed.');
            }

            if ($actorMembership->role !== 'owner' && $membership->role === 'admin') {
                throw new InvalidArgumentException('Only the owner can change another admin.');
            }

            $membership->forceFill([
                'role' => $role,
            ])->save();

            return $conversation->fresh([
                'creator.avatarObject',
                'avatarObject',
                'lastMessage.sender.avatarObject',
                'members.user.avatarObject',
            ]);
        });
    }
}
