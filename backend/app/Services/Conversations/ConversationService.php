<?php

namespace App\Services\Conversations;

use App\Models\Conversation;
use App\Models\ConversationMember;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ConversationService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    public function listForUser(int $userId): Collection
    {
        return Conversation::query()
            ->whereHas('members', function ($query) use ($userId): void {
                $query
                    ->where('user_id', $userId)
                    ->where('membership_state', 'active');
            })
            ->with([
                'creator',
                'avatarObject',
                'members.user',
                'lastMessage.sender',
                'members' => fn ($query) => $query->where('user_id', $userId),
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get();
    }

    public function getOrCreateDirect(int $authUserId, int $targetUserId): Conversation
    {
        if ($authUserId === $targetUserId) {
            throw new InvalidArgumentException('You cannot start a direct conversation with yourself.');
        }

        $directKey = $this->directKey($authUserId, $targetUserId);

        return DB::transaction(function () use ($authUserId, $directKey, $targetUserId): Conversation {
            $conversation = Conversation::query()->firstWhere('direct_key', $directKey);

            if (! $conversation) {
                $conversation = Conversation::query()->create([
                    'type' => 'direct',
                    'direct_key' => $directKey,
                    'created_by' => $authUserId,
                ]);

                $this->attachMember($conversation->id, $authUserId, 'owner', $authUserId);
                $this->attachMember($conversation->id, $targetUserId, 'member', $authUserId);
            }

            return $this->loadConversationForUser($conversation, $authUserId);
        });
    }

    public function createGroup(int $creatorId, array $memberIds, array $payload): Conversation
    {
        $memberIds = collect($memberIds)
            ->map(static fn ($id) => (int) $id)
            ->filter(static fn ($id) => $id > 0)
            ->unique()
            ->reject(static fn ($id) => $id === $creatorId)
            ->values();

        if ($memberIds->isEmpty()) {
            throw new InvalidArgumentException('A group needs at least one additional member.');
        }

        if ($memberIds->count() + 1 > 12) {
            throw new InvalidArgumentException('A group may include at most 12 members.');
        }

        return DB::transaction(function () use ($creatorId, $memberIds, $payload): Conversation {
            $conversation = Conversation::query()->create([
                'type' => 'group',
                'title' => $payload['title'],
                'description' => $payload['description'] ?? null,
                'avatar_object_id' => $payload['avatar_object_id'] ?? null,
                'created_by' => $creatorId,
                'settings_json' => $payload['settings_json'] ?? null,
            ]);

            $this->attachMember($conversation->id, $creatorId, 'owner', $creatorId);

            foreach ($memberIds as $memberId) {
                $this->attachMember($conversation->id, $memberId, 'member', $creatorId);
            }

            return $this->loadConversationForUser($conversation, $creatorId);
        });
    }

    public function updateGroup(Conversation $conversation, int $actorId, array $payload): Conversation
    {
        $this->conversationMemberService->ensureGroupManager($conversation, $actorId);

        $conversation->fill([
            'title' => $payload['title'] ?? $conversation->title,
            'description' => array_key_exists('description', $payload) ? $payload['description'] : $conversation->description,
            'avatar_object_id' => array_key_exists('avatar_object_id', $payload) ? $payload['avatar_object_id'] : $conversation->avatar_object_id,
            'settings_json' => array_key_exists('settings_json', $payload) ? $payload['settings_json'] : $conversation->settings_json,
        ])->save();

        return $this->loadConversationForUser($conversation, $actorId);
    }

    public function showForUser(Conversation $conversation, int $userId): Conversation
    {
        $this->conversationMemberService->requireActiveMembership($conversation, $userId);

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function archive(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill(['archived_at' => now()])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function unarchive(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill(['archived_at' => null])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function pin(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill(['pinned_at' => now()])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function unpin(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill(['pinned_at' => null])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function mute(Conversation $conversation, int $userId, ?string $mutedUntil): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill([
            'muted_until' => $mutedUntil ? now()->parse($mutedUntil) : null,
        ])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function markRead(Conversation $conversation, int $userId, int $lastSeq): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $safeSeq = min($lastSeq, (int) $conversation->last_message_seq);

        $membership->forceFill([
            'last_read_seq' => max($membership->last_read_seq, $safeSeq),
            'last_delivered_seq' => max($membership->last_delivered_seq, $safeSeq),
            'unread_count_cache' => 0,
        ])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    protected function directKey(int $leftUserId, int $rightUserId): string
    {
        $sorted = [$leftUserId, $rightUserId];
        sort($sorted);

        return hash('sha256', implode(':', $sorted));
    }

    protected function attachMember(int $conversationId, int $userId, string $role, int $actorId): void
    {
        ConversationMember::query()->create([
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'role' => $role,
            'membership_state' => 'active',
            'added_by_user_id' => $actorId,
            'joined_at' => now(),
        ]);
    }

    protected function loadConversationForUser(Conversation $conversation, int $userId): Conversation
    {
        return $conversation->fresh([
            'creator',
            'avatarObject',
            'lastMessage.sender',
            'members.user',
            'members' => fn ($query) => $query->where('user_id', $userId),
        ]);
    }
}
