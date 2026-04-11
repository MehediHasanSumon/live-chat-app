<?php

namespace App\Services\Conversations;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\MessageAttachment;
use App\Models\StorageObject;
use App\Services\Privacy\PrivacyService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ConversationService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
        protected PrivacyService $privacyService,
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
                'lastMessage.sender',
                'members.user',
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
            $targetMembershipState = $this->privacyService->shouldCreateMessageRequest($authUserId, $targetUserId)
                ? 'request_pending'
                : 'active';

            if (! $conversation) {
                $conversation = Conversation::query()->create([
                    'type' => 'direct',
                    'direct_key' => $directKey,
                    'created_by' => $authUserId,
                ]);

                $this->attachMember($conversation->id, $authUserId, 'owner', $authUserId, 'active');
                $this->attachMember($conversation->id, $targetUserId, 'member', $authUserId, $targetMembershipState);
            } else {
                $this->syncDirectMembership($conversation->id, $authUserId, 'owner', $authUserId, 'active');

                $existingTargetMembership = ConversationMember::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('user_id', $targetUserId)
                    ->first();

                if ($existingTargetMembership?->membership_state !== 'active') {
                    $this->syncDirectMembership($conversation->id, $targetUserId, 'member', $authUserId, $targetMembershipState);
                }
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

            $this->attachMember($conversation->id, $creatorId, 'owner', $creatorId, 'active');

            foreach ($memberIds as $memberId) {
                $this->attachMember($conversation->id, $memberId, 'member', $creatorId, 'active');
            }

            return $this->loadConversationForUser($conversation, $creatorId);
        });
    }

    public function updateGroup(Conversation $conversation, int $actorId, array $payload): Conversation
    {
        $this->conversationMemberService->ensureGroupManager($conversation, $actorId);
        $validatedAvatarObjectId = $this->resolveValidatedGroupAvatarObjectId($payload, $actorId);

        $conversation->fill([
            'title' => $payload['title'] ?? $conversation->title,
            'description' => array_key_exists('description', $payload) ? $payload['description'] : $conversation->description,
            'avatar_object_id' => $validatedAvatarObjectId ?? $conversation->avatar_object_id,
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

    public function markUnread(Conversation $conversation, int $userId): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $lastMessageSeq = (int) $conversation->last_message_seq;

        if ($lastMessageSeq <= 0) {
            return $this->loadConversationForUser($conversation, $userId);
        }

        $newLastReadSeq = min($membership->last_read_seq, $lastMessageSeq - 1);
        $derivedUnreadCount = max(1, $lastMessageSeq - $newLastReadSeq);

        $membership->forceFill([
            'last_read_seq' => max(0, $newLastReadSeq),
            'unread_count_cache' => max($membership->unread_count_cache, $derivedUnreadCount),
            'archived_at' => null,
        ])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function setScheduledNotifications(Conversation $conversation, int $userId, array $payload): Conversation
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);
        $membership->forceFill([
            'notifications_mode' => $payload['notifications_mode'],
            'notification_schedule_json' => $payload['notification_schedule_json'] ?? null,
        ])->save();

        return $this->loadConversationForUser($conversation, $userId);
    }

    public function listSharedAttachments(Conversation $conversation, int $userId, string $kind, int $limit = 50): Collection
    {
        $this->conversationMemberService->requireActiveMembership($conversation, $userId);

        $mediaKinds = $kind === 'media'
            ? ['image', 'video', 'voice', 'gif']
            : ['file'];

        return MessageAttachment::query()
            ->where('conversation_id', $conversation->getKey())
            ->whereHas('storageObject', function ($builder) use ($mediaKinds): void {
                $builder
                    ->whereNull('deleted_at')
                    ->whereIn('media_kind', $mediaKinds);
            })
            ->whereHas('message', function ($builder) use ($userId): void {
                $builder
                    ->whereNull('deleted_for_everyone_at')
                    ->whereDoesntHave('hiddenForUsers', function ($hiddenBuilder) use ($userId): void {
                        $hiddenBuilder->where('user_id', $userId);
                    });
            })
            ->with(['storageObject', 'message.sender'])
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }

    protected function directKey(int $leftUserId, int $rightUserId): string
    {
        $sorted = [$leftUserId, $rightUserId];
        sort($sorted);

        return hash('sha256', implode(':', $sorted));
    }

    protected function attachMember(int $conversationId, int $userId, string $role, int $actorId, string $membershipState): void
    {
        ConversationMember::query()->create([
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'role' => $role,
            'membership_state' => $membershipState,
            'added_by_user_id' => $actorId,
            'joined_at' => $membershipState === 'active' ? now() : null,
            'request_created_at' => $membershipState === 'request_pending' ? now() : null,
        ]);
    }

    protected function syncDirectMembership(
        int $conversationId,
        int $userId,
        string $role,
        int $actorId,
        string $membershipState,
    ): void {
        ConversationMember::query()->updateOrCreate([
            'conversation_id' => $conversationId,
            'user_id' => $userId,
        ], [
            'role' => $role,
            'membership_state' => $membershipState,
            'added_by_user_id' => $actorId,
            'joined_at' => $membershipState === 'active' ? now() : null,
            'request_created_at' => $membershipState === 'request_pending' ? now() : null,
            'left_at' => null,
            'removed_at' => null,
        ]);
    }

    protected function loadConversationForUser(Conversation $conversation, int $userId): Conversation
    {
        return $conversation->fresh([
            'creator',
            'avatarObject',
            'lastMessage.sender',
            'members.user',
        ]);
    }

    protected function resolveValidatedGroupAvatarObjectId(array $payload, int $actorId): ?int
    {
        if (! array_key_exists('avatar_object_id', $payload)) {
            return null;
        }

        if ($payload['avatar_object_id'] === null) {
            return null;
        }

        $storageObject = StorageObject::query()->findOrFail((int) $payload['avatar_object_id']);

        if ((int) $storageObject->owner_user_id !== $actorId) {
            throw new InvalidArgumentException('You may only use group avatars that you uploaded.');
        }

        if ($storageObject->purpose !== 'group_avatar') {
            throw new InvalidArgumentException('Only group avatar uploads can be used for a group photo.');
        }

        if ($storageObject->deleted_at !== null) {
            throw new InvalidArgumentException('This uploaded group avatar is no longer available.');
        }

        return (int) $storageObject->getKey();
    }
}
