<?php

namespace App\Services\Privacy;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserRestriction;
use App\Models\UserSetting;
use App\Services\Realtime\PresenceService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PrivacyService
{
    public function __construct(
        protected PresenceService $presenceService,
    ) {
    }

    public function shouldCreateMessageRequest(int $senderId, int $targetUserId): bool
    {
        $settings = UserSetting::query()->firstWhere('user_id', $targetUserId);

        if ($settings?->allow_message_requests ?? true) {
            return true;
        }

        return UserRestriction::query()
            ->where('owner_user_id', $targetUserId)
            ->where('target_user_id', $senderId)
            ->where('move_to_requests', true)
            ->exists();
    }

    public function ensureChatAllowed(int $senderId, Conversation $conversation): void
    {
        if ($conversation->type !== 'direct') {
            return;
        }

        $targetUserId = $this->otherDirectUserId($conversation, $senderId);

        if ($targetUserId === null) {
            return;
        }

        if ($this->isChatBlockedBetween($senderId, $targetUserId)) {
            throw new InvalidArgumentException('Messaging is blocked for this conversation.');
        }
    }

    public function ensureDirectCallAllowed(int $callerId, Conversation $conversation): void
    {
        if ($conversation->type !== 'direct') {
            return;
        }

        $targetUserId = $this->otherDirectUserId($conversation, $callerId);

        if ($targetUserId === null) {
            throw new InvalidArgumentException('This direct call target could not be resolved.');
        }

        if ($this->isCallBlockedBetween($callerId, $targetUserId)) {
            throw new InvalidArgumentException('Calling is not allowed with this user.');
        }

        $targetMembershipState = ConversationMember::query()
            ->where('conversation_id', $conversation->getKey())
            ->where('user_id', $targetUserId)
            ->value('membership_state');

        if ($targetMembershipState !== 'active') {
            throw new InvalidArgumentException('Calls are only allowed after the message request is accepted.');
        }
    }

    public function ensureGroupCallAllowed(int $callerId, Conversation $conversation, array $participantIds): void
    {
        foreach ($participantIds as $participantId) {
            $participantId = (int) $participantId;

            if ($participantId === $callerId) {
                continue;
            }

            if ($this->isCallBlockedBetween($callerId, $participantId)) {
                throw new InvalidArgumentException('One or more members cannot be called because of privacy restrictions.');
            }
        }
    }

    public function listMessageRequests(int $userId): Collection
    {
        return Conversation::query()
            ->where('type', 'direct')
            ->whereHas('members', function ($query) use ($userId): void {
                $query
                    ->where('user_id', $userId)
                    ->where('membership_state', 'request_pending');
            })
            ->with([
                'creator',
                'avatarObject',
                'members.user',
                'lastMessage.sender',
                'members' => fn ($query) => $query->where('user_id', $userId),
            ])
            ->orderByDesc('updated_at')
            ->get();
    }

    public function acceptMessageRequest(Conversation $conversation, int $userId): Conversation
    {
        if ($conversation->type !== 'direct') {
            throw new InvalidArgumentException('Message requests only apply to direct conversations.');
        }

        return DB::transaction(function () use ($conversation, $userId): Conversation {
            $membership = ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($membership->membership_state !== 'request_pending') {
                throw new InvalidArgumentException('There is no pending message request for this conversation.');
            }

            $membership->forceFill([
                'membership_state' => 'active',
                'joined_at' => $membership->joined_at ?? now(),
                'request_created_at' => null,
            ])->save();

            return $conversation->fresh([
                'creator',
                'avatarObject',
                'lastMessage.sender',
                'members.user',
                'members' => fn ($query) => $query->where('user_id', $userId),
            ]);
        });
    }

    public function rejectMessageRequest(Conversation $conversation, int $userId): Conversation
    {
        if ($conversation->type !== 'direct') {
            throw new InvalidArgumentException('Message requests only apply to direct conversations.');
        }

        return DB::transaction(function () use ($conversation, $userId): Conversation {
            $membership = ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($membership->membership_state !== 'request_pending') {
                throw new InvalidArgumentException('There is no pending message request for this conversation.');
            }

            $membership->forceFill([
                'membership_state' => 'removed',
                'removed_at' => now(),
            ])->save();

            return $conversation->fresh([
                'creator',
                'avatarObject',
                'lastMessage.sender',
                'members.user',
                'members' => fn ($query) => $query->where('user_id', $userId),
            ]);
        });
    }

    public function blockUser(int $actorId, int $targetUserId): UserBlock
    {
        $this->ensureDifferentUsers($actorId, $targetUserId);

        return UserBlock::query()->updateOrCreate([
            'blocker_user_id' => $actorId,
            'blocked_user_id' => $targetUserId,
        ], [
            'block_chat' => true,
            'block_call' => true,
            'hide_presence' => true,
            'created_at' => now(),
        ]);
    }

    public function unblockUser(int $actorId, int $targetUserId): bool
    {
        return UserBlock::query()
            ->where('blocker_user_id', $actorId)
            ->where('blocked_user_id', $targetUserId)
            ->delete() > 0;
    }

    public function restrictUser(int $actorId, int $targetUserId): UserRestriction
    {
        $this->ensureDifferentUsers($actorId, $targetUserId);

        return UserRestriction::query()->updateOrCreate([
            'owner_user_id' => $actorId,
            'target_user_id' => $targetUserId,
        ], [
            'move_to_requests' => true,
            'mute_notifications' => true,
            'prevent_calling' => true,
            'created_at' => now(),
        ]);
    }

    public function unrestrictUser(int $actorId, int $targetUserId): bool
    {
        return UserRestriction::query()
            ->where('owner_user_id', $actorId)
            ->where('target_user_id', $targetUserId)
            ->delete() > 0;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolvePresenceVisibility(int $viewerId, User $targetUser): array
    {
        $viewerBlocksTarget = UserBlock::query()
            ->where('blocker_user_id', $viewerId)
            ->where('blocked_user_id', $targetUser->getKey())
            ->where('hide_presence', true)
            ->exists();

        $targetBlocksViewer = UserBlock::query()
            ->where('blocker_user_id', $targetUser->getKey())
            ->where('blocked_user_id', $viewerId)
            ->where('hide_presence', true)
            ->exists();

        $showActiveStatus = (bool) ($targetUser->settings?->show_active_status ?? true);
        $isVisible = ! $viewerBlocksTarget && ! $targetBlocksViewer && $showActiveStatus;
        $presenceKey = $this->presenceService->cacheKey($targetUser->getKey());
        $presencePayload = $isVisible ? Cache::get($presenceKey) : null;

        return [
            'user_id' => $targetUser->getKey(),
            'visible' => $isVisible,
            'is_online' => $isVisible ? $presencePayload !== null : false,
            'last_seen_at' => $isVisible ? $targetUser->last_seen_at?->toIso8601String() : null,
            'presence_key' => $isVisible ? $presenceKey : null,
        ];
    }

    protected function isChatBlockedBetween(int $senderId, int $targetUserId): bool
    {
        return UserBlock::query()
            ->where(function ($query) use ($senderId, $targetUserId): void {
                $query
                    ->where('blocker_user_id', $senderId)
                    ->where('blocked_user_id', $targetUserId);
            })
            ->orWhere(function ($query) use ($senderId, $targetUserId): void {
                $query
                    ->where('blocker_user_id', $targetUserId)
                    ->where('blocked_user_id', $senderId);
            })
            ->where('block_chat', true)
            ->exists();
    }

    protected function isCallBlockedBetween(int $callerId, int $targetUserId): bool
    {
        $isBlocked = UserBlock::query()
            ->where(function ($query) use ($callerId, $targetUserId): void {
                $query
                    ->where('blocker_user_id', $callerId)
                    ->where('blocked_user_id', $targetUserId);
            })
            ->orWhere(function ($query) use ($callerId, $targetUserId): void {
                $query
                    ->where('blocker_user_id', $targetUserId)
                    ->where('blocked_user_id', $callerId);
            })
            ->where('block_call', true)
            ->exists();

        if ($isBlocked) {
            return true;
        }

        return UserRestriction::query()
            ->where('owner_user_id', $targetUserId)
            ->where('target_user_id', $callerId)
            ->where('prevent_calling', true)
            ->exists();
    }

    protected function otherDirectUserId(Conversation $conversation, int $actorId): ?int
    {
        return $conversation->members()
            ->where('user_id', '!=', $actorId)
            ->value('user_id');
    }

    protected function ensureDifferentUsers(int $actorId, int $targetUserId): void
    {
        if ($actorId === $targetUserId) {
            throw new InvalidArgumentException('You cannot apply this moderation rule to yourself.');
        }
    }
}
