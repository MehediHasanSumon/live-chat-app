<?php

namespace App\Services\Calls;

use App\Models\CallRoom;
use App\Models\CallRoomParticipant;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Conversations\ConversationMemberService;
use App\Services\Conversations\ConversationService;
use App\Services\LiveKit\LiveKitRoomService;
use App\Services\LiveKit\LiveKitTokenService;
use App\Services\Messages\MessageService;
use App\Services\Privacy\PrivacyService;
use App\Services\Realtime\PresenceService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class CallService
{
    public function __construct(
        protected ConversationService $conversationService,
        protected ConversationMemberService $conversationMemberService,
        protected LiveKitRoomService $liveKitRoomService,
        protected LiveKitTokenService $liveKitTokenService,
        protected MessageService $messageService,
        protected PrivacyService $privacyService,
        protected PresenceService $presenceService,
    ) {
    }

    /**
     * @return array{call_room: CallRoom, notify_user_ids: array<int>}
     */
    public function startDirect(int $callerId, int $targetUserId, string $mediaType): array
    {
        $conversation = $this->conversationService->getOrCreateDirect($callerId, $targetUserId);
        $this->privacyService->ensureDirectCallAllowed($callerId, $conversation);

        $callRoom = $this->createCallRoom(
            $conversation,
            $callerId,
            $mediaType,
            'direct',
            [$callerId, $targetUserId],
        );

        return [
            'call_room' => $callRoom,
            'notify_user_ids' => [$targetUserId],
        ];
    }

    /**
     * @return array{call_room: CallRoom, notify_user_ids: array<int>}
     */
    public function startGroup(Conversation $conversation, int $callerId, string $mediaType): array
    {
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $callerId);
        $whoCanStartCall = $conversation->settings_json['who_can_start_call'] ?? 'all';

        if ($whoCanStartCall === 'admins_only' && ! in_array($membership->role, ['owner', 'admin'], true)) {
            throw new InvalidArgumentException('Only group admins can start a call in this conversation.');
        }

        $memberIds = $conversation->members()
            ->where('membership_state', 'active')
            ->orderBy('id')
            ->pluck('user_id')
            ->map(static fn ($id) => (int) $id)
            ->values()
            ->all();

        $this->privacyService->ensureGroupCallAllowed($callerId, $conversation, $memberIds);

        $callRoom = $this->createCallRoom(
            $conversation,
            $callerId,
            $mediaType,
            'group',
            $memberIds,
        );

        return [
            'call_room' => $callRoom,
            'notify_user_ids' => array_values(array_filter($memberIds, static fn (int $userId): bool => $userId !== $callerId)),
        ];
    }

    public function accept(CallRoom $callRoom, int $userId): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (in_array($lockedRoom->status, CallRoom::TERMINAL_STATUSES, true)) {
                throw new InvalidArgumentException('This call is no longer active.');
            }

            $participant = $this->lockParticipant($lockedRoom->id, $userId);
            $roomIsLocked = CallRoom::query()
                ->whereKey($lockedRoom->id)
                ->where('is_locked', 1)
                ->exists()
                || (int) $lockedRoom->getRawOriginal('is_locked') === 1;

            if ($roomIsLocked && $participant->invite_status !== 'accepted') {
                throw new InvalidArgumentException('This call is locked and cannot accept new participants.');
            }

            $participant->forceFill([
                'invite_status' => 'accepted',
            ])->save();

            $this->applyResolvedStatus($lockedRoom);

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    public function decline(CallRoom $callRoom, int $userId): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (in_array($lockedRoom->status, CallRoom::TERMINAL_STATUSES, true)) {
                return $lockedRoom;
            }

            $participant = $this->lockParticipant($lockedRoom->id, $userId);

            if ($participant->user_id === $lockedRoom->created_by) {
                throw new InvalidArgumentException('The caller cannot decline their own call.');
            }

            $participant->forceFill([
                'invite_status' => 'declined',
                'left_at' => now(),
                'left_reason' => 'declined',
            ])->save();

            $hasPendingInvitees = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->whereIn('invite_status', ['invited', 'ringing'])
                ->exists();

            $hasAcceptedOthers = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->where('user_id', '!=', $lockedRoom->created_by)
                ->where('invite_status', 'accepted')
                ->exists();

            if (! $hasPendingInvitees && ! $hasAcceptedOthers) {
                $this->finishLockedRoom($lockedRoom, 'declined', 'all_declined');
            } else {
                $this->applyResolvedStatus($lockedRoom);
            }

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    public function markOnlineParticipantsRinging(CallRoom $callRoom, ?array $participantUserIds = null): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $participantUserIds): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (! in_array($lockedRoom->status, ['calling', 'ringing'], true)) {
                return $lockedRoom;
            }

            $candidateQuery = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->where('user_id', '!=', $lockedRoom->created_by)
                ->where('invite_status', 'invited');

            if (is_array($participantUserIds) && $participantUserIds !== []) {
                $candidateQuery->whereIn('user_id', $participantUserIds);
            }

            $onlineUserIds = $candidateQuery
                ->pluck('user_id')
                ->map(static fn ($userId): int => (int) $userId)
                ->filter(fn (int $userId): bool => $this->presenceService->activePresence($userId) !== null)
                ->values()
                ->all();

            if ($onlineUserIds === []) {
                $this->applyResolvedStatus($lockedRoom);

                return $lockedRoom;
            }

            CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->whereIn('user_id', $onlineUserIds)
                ->where('invite_status', 'invited')
                ->update([
                    'invite_status' => 'ringing',
                    'updated_at' => now(),
                ]);

            $this->applyResolvedStatus($lockedRoom);

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    public function end(CallRoom $callRoom, int $userId, ?string $reason = null): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $reason, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);
            $participant = $this->lockParticipant($lockedRoom->id, $userId);

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            if ($lockedRoom->scope !== 'group') {
                $this->finishLockedRoom($lockedRoom, 'ended', $reason ?: 'ended_by_participant');

                return $lockedRoom;
            }

            $this->leaveLockedParticipant($participant, $reason ?: 'left_by_participant');

            if ($this->shouldFinishAfterParticipantLeft($lockedRoom)) {
                $this->finishLockedRoom($lockedRoom, 'ended', $reason ?: 'participants_left');
            } else {
                $this->applyResolvedStatus($lockedRoom);
            }

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @throws AuthorizationException
     */
    public function endForAll(CallRoom $callRoom, int $userId, ?string $reason = null): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $reason, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            if (! $this->canEndForAll($lockedRoom, $userId)) {
                throw new AuthorizationException('You are not allowed to end this call for everyone.');
            }

            $this->finishLockedRoom($lockedRoom, 'ended', $reason ?: 'ended_for_everyone');

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @throws AuthorizationException
     */
    public function lockRoom(CallRoom $callRoom, int $userId): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if ($lockedRoom->scope !== 'group') {
                throw new InvalidArgumentException('Only group calls can be locked.');
            }

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            $this->ensureCanManageGroupRoom($lockedRoom, $userId);

            if (! $lockedRoom->is_locked) {
                $lockedRoom->forceFill([
                    'is_locked' => true,
                ])->save();
            }

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @throws AuthorizationException
     */
    public function unlockRoom(CallRoom $callRoom, int $userId): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if ($lockedRoom->scope !== 'group') {
                throw new InvalidArgumentException('Only group calls can be unlocked.');
            }

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            $this->ensureCanManageGroupRoom($lockedRoom, $userId);

            if ($lockedRoom->is_locked) {
                $lockedRoom->forceFill([
                    'is_locked' => false,
                ])->save();
            }

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @throws AuthorizationException
     */
    public function removeParticipant(CallRoom $callRoom, int $actorUserId, int $targetUserId, ?string $reason = null): CallRoom
    {
        $removedParticipantIdentity = null;

        $updatedRoom = DB::transaction(function () use ($actorUserId, $callRoom, $reason, $targetUserId, &$removedParticipantIdentity): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if ($lockedRoom->scope !== 'group') {
                throw new InvalidArgumentException('Only group calls support participant removal.');
            }

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            $this->ensureCanManageGroupRoom($lockedRoom, $actorUserId);

            if ($targetUserId === $actorUserId) {
                throw new InvalidArgumentException('Use leave to exit the call yourself.');
            }

            if ($targetUserId === $lockedRoom->created_by) {
                throw new InvalidArgumentException('The call creator cannot be removed from the room.');
            }

            $participant = $this->lockParticipant($lockedRoom->id, $targetUserId);

            if (in_array($participant->invite_status, ['kicked', 'left', 'declined', 'missed'], true)) {
                return $lockedRoom;
            }

            $participant->forceFill([
                'invite_status' => 'kicked',
                'left_at' => $participant->left_at ?? now(),
                'left_reason' => Str::limit($reason ?: 'removed_by_manager', 60, ''),
                'is_video_publisher' => false,
            ])->save();

            $removedParticipantIdentity = (string) $participant->user_id;

            if ($this->shouldFinishAfterParticipantLeft($lockedRoom)) {
                $this->finishLockedRoom($lockedRoom, 'ended', 'participants_left');
            } else {
                $this->applyResolvedStatus($lockedRoom);
            }

            return $lockedRoom;
        });

        if ($removedParticipantIdentity !== null) {
            DB::afterCommit(function () use ($callRoom, $removedParticipantIdentity): void {
                $this->liveKitRoomService->removeParticipant($callRoom->room_uuid, $removedParticipantIdentity);
            });
        }

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @return array{call_room: CallRoom, notify_user_ids: array<int>}
     *
     * @throws AuthorizationException
     */
    public function muteAll(CallRoom $callRoom, int $actorUserId): array
    {
        $updatedRoom = DB::transaction(function () use ($actorUserId, $callRoom): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if ($lockedRoom->scope !== 'group') {
                throw new InvalidArgumentException('Only group calls support mute all.');
            }

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                throw new InvalidArgumentException('This call is no longer active.');
            }

            $this->ensureCanManageGroupRoom($lockedRoom, $actorUserId);

            return $lockedRoom;
        });

        $loadedRoom = $this->loadCallRoom($updatedRoom->room_uuid);
        $notifyUserIds = $loadedRoom->participants
            ->where('invite_status', 'accepted')
            ->where('user_id', '!=', $actorUserId)
            ->pluck('user_id')
            ->map(static fn ($userId) => (int) $userId)
            ->values()
            ->all();

        return [
            'call_room' => $loadedRoom,
            'notify_user_ids' => $notifyUserIds,
        ];
    }

    /**
     * @param  array<int>  $targetUserIds
     * @return array{call_room: CallRoom, notify_user_ids: array<int>}
     *
     * @throws AuthorizationException
     */
    public function inviteParticipants(CallRoom $callRoom, int $actorUserId, array $targetUserIds): array
    {
        $notifyUserIds = [];

        $updatedRoom = DB::transaction(function () use ($actorUserId, $callRoom, &$notifyUserIds, $targetUserIds): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if ($lockedRoom->scope !== 'group') {
                throw new InvalidArgumentException('Only group calls support inviting more members.');
            }

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                throw new InvalidArgumentException('This call is no longer active.');
            }

            if ($lockedRoom->is_locked) {
                throw new InvalidArgumentException('Unlock the room before inviting more members.');
            }

            $this->ensureCanManageGroupRoom($lockedRoom, $actorUserId);

            $conversation = Conversation::query()
                ->whereKey($lockedRoom->conversation_id)
                ->lockForUpdate()
                ->firstOrFail();

            $normalizedUserIds = collect($targetUserIds)
                ->map(static fn ($userId) => (int) $userId)
                ->filter(static fn ($userId) => $userId > 0)
                ->reject(static fn ($userId) => $userId === $actorUserId)
                ->unique()
                ->values();

            if ($normalizedUserIds->isEmpty()) {
                throw new InvalidArgumentException('Select at least one member to invite.');
            }

            $activeConversationMemberIds = $conversation->members()
                ->where('membership_state', 'active')
                ->pluck('user_id')
                ->map(static fn ($userId) => (int) $userId)
                ->values();

            $invalidUserIds = $normalizedUserIds
                ->diff($activeConversationMemberIds)
                ->values();

            if ($invalidUserIds->isNotEmpty()) {
                throw new InvalidArgumentException('Only active conversation members can be invited.');
            }

            $currentParticipantCount = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->count();

            $availableCapacity = max($lockedRoom->max_participants - $currentParticipantCount, 0);
            $requestedNewSlots = 0;

            $existingParticipants = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->whereIn('user_id', $normalizedUserIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('user_id');

            $newInviteTargets = $normalizedUserIds
                ->reject(fn (int $userId) => $existingParticipants->has($userId))
                ->values();

            $requestedNewSlots = $newInviteTargets->count();

            if ($requestedNewSlots > $availableCapacity) {
                throw new InvalidArgumentException('This call room is already at capacity.');
            }

            $inviteCandidateIds = $normalizedUserIds->all();
            $this->privacyService->ensureGroupCallAllowed($actorUserId, $conversation, $inviteCandidateIds);

            foreach ($normalizedUserIds as $targetUserId) {
                /** @var CallRoomParticipant|null $participant */
                $participant = $existingParticipants->get($targetUserId);

                if (! $participant) {
                    CallRoomParticipant::query()->create([
                        'call_room_id' => $lockedRoom->id,
                        'user_id' => $targetUserId,
                        'invite_status' => 'ringing',
                        'is_video_publisher' => false,
                    ]);

                    $notifyUserIds[] = $targetUserId;
                    continue;
                }

                if (in_array($participant->invite_status, ['invited', 'ringing', 'accepted'], true)) {
                    continue;
                }

                $participant->forceFill([
                    'invite_status' => 'ringing',
                    'joined_at' => null,
                    'left_at' => null,
                    'left_reason' => null,
                    'is_video_publisher' => false,
                ])->save();

                $notifyUserIds[] = $targetUserId;
            }

            if (! empty($notifyUserIds)) {
                $this->applyResolvedStatus($lockedRoom);
            }

            return $lockedRoom;
        });

        $loadedRoom = $this->loadCallRoom($updatedRoom->room_uuid);

        return [
            'call_room' => $loadedRoom,
            'notify_user_ids' => array_values(array_unique(array_map(static fn ($userId) => (int) $userId, $notifyUserIds))),
        ];
    }

    /**
     * @return array{call_room: CallRoom, token: array<string, mixed>, publish_mode: string}
     */
    public function issueJoinToken(CallRoom $callRoom, User $user, bool $wantsVideo = false): array
    {
        $payload = DB::transaction(function () use ($callRoom, $user, $wantsVideo): array {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                throw new InvalidArgumentException('This call can no longer be joined.');
            }

            $participant = $this->lockParticipant($lockedRoom->id, $user->getKey());

            if ($participant->invite_status !== 'accepted') {
                throw new InvalidArgumentException('Accept the call before requesting a join token.');
            }

            $canPublishSources = ['microphone'];
            $publishMode = 'audio';

            if ($lockedRoom->media_type === 'video' && $wantsVideo) {
                $currentVideoPublishers = CallRoomParticipant::query()
                    ->where('call_room_id', $lockedRoom->id)
                    ->where('is_video_publisher', true)
                    ->where('user_id', '!=', $user->getKey())
                    ->count();

                if ($participant->is_video_publisher || $currentVideoPublishers < $lockedRoom->max_video_publishers) {
                    $participant->forceFill([
                        'is_video_publisher' => true,
                    ])->save();

                    $canPublishSources = ['microphone', 'camera'];
                    $publishMode = 'video';
                }
            } elseif ($participant->is_video_publisher) {
                $participant->forceFill([
                    'is_video_publisher' => false,
                ])->save();
            }

            $token = $this->liveKitTokenService->issueJoinToken($user, $lockedRoom->room_uuid, [
                'can_publish' => true,
                'can_subscribe' => true,
                'can_publish_data' => true,
                'can_update_own_metadata' => false,
                'can_publish_sources' => $canPublishSources,
            ]);

            return [
                'call_room' => $lockedRoom,
                'token' => $token,
                'publish_mode' => $publishMode,
            ];
        });

        return [
            'call_room' => $this->loadCallRoom($callRoom->room_uuid),
            'token' => $payload['token'],
            'publish_mode' => $payload['publish_mode'],
        ];
    }

    public function resolveRealtimeAction(CallRoom $callRoom, ?string $fallback = null): string
    {
        return match ($callRoom->status) {
            'calling' => 'calling',
            'ringing' => 'ringing',
            'connecting' => 'connecting',
            'active' => 'in_call',
            'ended' => 'ended',
            'declined' => 'declined',
            'missed' => 'missed',
            'cancelled' => 'cancelled',
            'failed' => 'failed',
            default => $fallback ?? 'updated',
        };
    }

    /**
     * @return array{message: \App\Models\Message, created: bool}
     */
    public function syncCallHistoryMessage(CallRoom $callRoom, string $action, ?int $actorId = null): array
    {
        return $this->messageService->syncCallEvent($callRoom, $action, $actorId);
    }

    /**
     * @return Collection<int, array{call_room: CallRoom, action: string}>
     */
    public function cleanupStaleRooms(?Carbon $now = null): Collection
    {
        $now ??= now();

        $candidateRoomUuids = CallRoom::query()
            ->whereIn('status', ['calling', 'ringing', 'connecting'])
            ->orderBy('id')
            ->pluck('room_uuid');

        return $candidateRoomUuids
            ->map(function (string $roomUuid) use ($now): ?array {
                $cleanedRoom = DB::transaction(function () use ($now, $roomUuid): ?CallRoom {
                    $lockedRoom = CallRoom::query()
                        ->where('room_uuid', $roomUuid)
                        ->lockForUpdate()
                        ->first();

                    if (! $lockedRoom || ! $this->isPastCleanupDeadline($lockedRoom, $now)) {
                        return null;
                    }

                    [$status, $reason] = $this->resolveStaleRoomOutcome($lockedRoom);
                    $this->finishLockedRoom($lockedRoom, $status, $reason);

                    return $lockedRoom;
                });

                if (! $cleanedRoom) {
                    return null;
                }

                $callRoom = $this->loadCallRoom($cleanedRoom->room_uuid);

                return [
                    'call_room' => $callRoom,
                    'action' => $this->resolveRealtimeAction($callRoom),
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * @return array{call_room: ?CallRoom, action: ?string}
     */
    public function handleWebhook(array $payload): array
    {
        $eventName = $payload['event'] ?? null;
        $roomUuid = $payload['room']['name'] ?? null;

        if (! is_string($eventName) || ! is_string($roomUuid) || $roomUuid === '') {
            return [
                'call_room' => null,
                'action' => null,
            ];
        }

        return match ($eventName) {
            'participant_joined' => [
                'call_room' => $callRoom = $this->syncParticipantJoined($roomUuid, $payload),
                'action' => $callRoom ? $this->resolveRealtimeAction($callRoom, 'connecting') : 'connecting',
            ],
            'participant_left' => [
                'call_room' => $callRoom = $this->syncParticipantLeft($roomUuid, $payload),
                'action' => $callRoom ? $this->resolveRealtimeAction($callRoom, 'ended') : 'ended',
            ],
            'room_finished' => [
                'call_room' => $callRoom = $this->syncRoomFinished($roomUuid),
                'action' => $callRoom ? $this->resolveRealtimeAction($callRoom, 'ended') : 'ended',
            ],
            'room_started' => [
                'call_room' => $callRoom = $this->syncRoomStarted($roomUuid),
                'action' => $callRoom ? $this->resolveRealtimeAction($callRoom, 'connecting') : 'connecting',
            ],
            default => [
                'call_room' => $callRoom = $this->touchWebhookTimestamp($roomUuid),
                'action' => $callRoom ? $this->resolveRealtimeAction($callRoom, 'updated') : 'updated',
            ],
        };
    }

    protected function createCallRoom(
        Conversation $conversation,
        int $callerId,
        string $mediaType,
        string $scope,
        array $participantIds,
    ): CallRoom {
        if (! in_array($mediaType, ['voice', 'video'], true)) {
            throw new InvalidArgumentException('Unsupported call media type.');
        }

        $participants = collect($participantIds)
            ->map(static fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($participants->isEmpty() || ! $participants->contains($callerId)) {
            throw new InvalidArgumentException('The caller must be part of the room.');
        }

        $defaultMaxParticipants = (int) config('livekit.default_room_max_participants', 12);

        if ($participants->count() > $defaultMaxParticipants) {
            throw new InvalidArgumentException("A call may include at most {$defaultMaxParticipants} participants.");
        }

        $roomUuid = (string) Str::uuid();

        $callRoom = DB::transaction(function () use ($callerId, $conversation, $defaultMaxParticipants, $mediaType, $participants, $roomUuid, $scope): CallRoom {
            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($this->findActiveConversationCall($lockedConversation->id)) {
                throw new InvalidArgumentException('A call is already active for this conversation.');
            }

            $callRoom = CallRoom::query()->create([
                'room_uuid' => $roomUuid,
                'conversation_id' => $lockedConversation->id,
                'scope' => $scope,
                'media_type' => $mediaType,
                'created_by' => $callerId,
                'status' => 'calling',
                'is_locked' => false,
                'max_participants' => $scope === 'group'
                    ? $defaultMaxParticipants
                    : $participants->count(),
                'max_video_publishers' => $mediaType === 'video'
                    ? min((int) config('livekit.default_room_max_video_publishers', 4), $participants->count())
                    : 0,
            ]);

            foreach ($participants as $participantId) {
                CallRoomParticipant::query()->create([
                    'call_room_id' => $callRoom->id,
                    'user_id' => $participantId,
                    'invite_status' => $participantId === $callerId
                        ? 'accepted'
                        : 'invited',
                    'is_video_publisher' => false,
                ]);
            }

            $lockedConversation->forceFill([
                'active_room_uuid' => $roomUuid,
            ])->save();

            return $callRoom;
        });

        try {
            $this->liveKitRoomService->createRoom($roomUuid, [
                'max_participants' => $callRoom->max_participants,
            ]);
        } catch (Throwable) {
            DB::transaction(function () use ($callRoom): void {
                $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);
                $this->finishLockedRoom($lockedRoom, 'failed', 'livekit_room_create_failed');
            });

            throw new InvalidArgumentException('The call room could not be created right now.');
        }

        Log::info('calls.room_created', [
            'room_uuid' => $roomUuid,
            'conversation_id' => $callRoom->conversation_id,
            'scope' => $callRoom->scope,
            'media_type' => $callRoom->media_type,
            'created_by' => $callerId,
            'participant_count' => $participants->count(),
            'max_participants' => $callRoom->max_participants,
        ]);

        return $this->loadCallRoom($roomUuid);
    }

    protected function syncParticipantJoined(string $roomUuid, array $payload): ?CallRoom
    {
        $userId = $this->participantIdentityToUserId($payload['participant']['identity'] ?? null);

        if ($userId === null) {
            return $this->touchWebhookTimestamp($roomUuid);
        }

        $callRoom = DB::transaction(function () use ($roomUuid, $userId): ?CallRoom {
            $lockedRoom = CallRoom::query()
                ->where('room_uuid', $roomUuid)
                ->lockForUpdate()
                ->first();

            if (! $lockedRoom) {
                return null;
            }

            $participant = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($participant) {
                $participant->forceFill([
                    'invite_status' => 'accepted',
                    'joined_at' => $participant->joined_at ?? now(),
                    'left_at' => null,
                    'left_reason' => null,
                ])->save();
            }

            $this->applyResolvedStatus($lockedRoom, true);

            return $lockedRoom;
        });

        return $callRoom ? $this->loadCallRoom($callRoom->room_uuid) : null;
    }

    protected function syncParticipantLeft(string $roomUuid, array $payload): ?CallRoom
    {
        $userId = $this->participantIdentityToUserId($payload['participant']['identity'] ?? null);
        $reason = $payload['participant']['disconnect_reason'] ?? 'participant_left';

        if ($userId === null) {
            return $this->touchWebhookTimestamp($roomUuid);
        }

        $callRoom = DB::transaction(function () use ($reason, $roomUuid, $userId): ?CallRoom {
            $lockedRoom = CallRoom::query()
                ->where('room_uuid', $roomUuid)
                ->lockForUpdate()
                ->first();

            if (! $lockedRoom) {
                return null;
            }

            $participant = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($participant) {
                $participant->forceFill([
                    'invite_status' => $participant->invite_status === 'accepted'
                        ? 'accepted'
                        : 'left',
                    'left_at' => now(),
                    'left_reason' => is_string($reason) ? Str::limit($reason, 60, '') : 'participant_left',
                    'is_video_publisher' => false,
                ])->save();
            }

            if ($this->shouldFinishAfterParticipantLeft($lockedRoom)) {
                $this->finishLockedRoom($lockedRoom, 'ended', 'participants_left');
            } else {
                $this->applyResolvedStatus($lockedRoom, true);
            }

            return $lockedRoom;
        });

        return $callRoom ? $this->loadCallRoom($callRoom->room_uuid) : null;
    }

    protected function syncRoomFinished(string $roomUuid): ?CallRoom
    {
        $callRoom = DB::transaction(function () use ($roomUuid): ?CallRoom {
            $lockedRoom = CallRoom::query()
                ->where('room_uuid', $roomUuid)
                ->lockForUpdate()
                ->first();

            if (! $lockedRoom) {
                return null;
            }

            $this->finishLockedRoom($lockedRoom, 'ended', 'room_finished');
            $lockedRoom->forceFill([
                'last_webhook_at' => now(),
            ])->save();

            return $lockedRoom;
        });

        return $callRoom ? $this->loadCallRoom($callRoom->room_uuid) : null;
    }

    protected function syncRoomStarted(string $roomUuid): ?CallRoom
    {
        $callRoom = DB::transaction(function () use ($roomUuid): ?CallRoom {
            $lockedRoom = CallRoom::query()
                ->where('room_uuid', $roomUuid)
                ->lockForUpdate()
                ->first();

            if (! $lockedRoom) {
                return null;
            }

            $this->applyResolvedStatus($lockedRoom, true);

            return $lockedRoom;
        });

        return $callRoom ? $this->loadCallRoom($callRoom->room_uuid) : null;
    }

    protected function touchWebhookTimestamp(string $roomUuid): ?CallRoom
    {
        $callRoom = CallRoom::query()->firstWhere('room_uuid', $roomUuid);

        if (! $callRoom) {
            return null;
        }

        $callRoom->forceFill([
            'last_webhook_at' => now(),
        ])->save();

        return $this->loadCallRoom($roomUuid);
    }

    protected function finishLockedRoom(CallRoom $callRoom, string $status, string $endedReason): void
    {
        $endedAt = $callRoom->ended_at ?? now();

        $callRoom->forceFill([
            'status' => $status,
            'ended_at' => $endedAt,
            'ended_reason' => Str::limit($endedReason, 60, ''),
            'duration_seconds' => $callRoom->started_at
                ? max($callRoom->started_at->diffInSeconds($endedAt), 0)
                : 0,
        ])->save();

        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->whereIn('invite_status', ['invited', 'ringing'])
            ->update([
                'invite_status' => 'missed',
                'left_at' => now(),
                'left_reason' => 'room_closed',
                'updated_at' => now(),
            ]);

        CallRoomParticipant::query()
            ->where('call_room_id', $callRoom->id)
            ->where('invite_status', 'accepted')
            ->whereNull('left_at')
            ->update([
                'invite_status' => 'left',
                'left_at' => now(),
                'left_reason' => 'room_closed',
                'updated_at' => now(),
            ]);

        Conversation::query()
            ->whereKey($callRoom->conversation_id)
            ->where('active_room_uuid', $callRoom->room_uuid)
            ->update([
                'active_room_uuid' => null,
            ]);

        $roomUuid = $callRoom->room_uuid;

        DB::afterCommit(function () use ($roomUuid): void {
            $this->liveKitRoomService->deleteRoom($roomUuid);
        });

        Log::info('calls.room_finished', [
            'room_uuid' => $callRoom->room_uuid,
            'conversation_id' => $callRoom->conversation_id,
            'status' => $status,
            'ended_reason' => $endedReason,
            'duration_seconds' => $callRoom->duration_seconds,
        ]);
    }

    protected function leaveLockedParticipant(CallRoomParticipant $participant, string $reason): void
    {
        $participant->forceFill([
            'invite_status' => 'left',
            'left_at' => $participant->left_at ?? now(),
            'left_reason' => Str::limit($reason, 60, ''),
            'is_video_publisher' => false,
        ])->save();
    }

    protected function applyResolvedStatus(CallRoom $callRoom, bool $touchedByWebhook = false): void
    {
        $resolvedStatus = $this->resolveRoomStatus($callRoom);
        $updates = [
            'status' => $resolvedStatus,
        ];

        if ($resolvedStatus === 'active') {
            $updates['started_at'] = $callRoom->started_at ?? now();
        }

        if ($touchedByWebhook) {
            $updates['last_webhook_at'] = now();
        }

        $callRoom->forceFill($updates)->save();
    }

    protected function resolveRoomStatus(CallRoom $callRoom): string
    {
        $participantQuery = CallRoomParticipant::query()->where('call_room_id', $callRoom->id);

        $joinedCount = (clone $participantQuery)
            ->whereNotNull('joined_at')
            ->whereNull('left_at')
            ->count();

        if ($joinedCount >= 2) {
            return 'active';
        }

        $acceptedCount = (clone $participantQuery)
            ->where('invite_status', 'accepted')
            ->count();

        if ($acceptedCount >= 2) {
            return 'connecting';
        }

        $hasRingingInvitees = (clone $participantQuery)
            ->where('invite_status', 'ringing')
            ->exists();

        if ($hasRingingInvitees) {
            return 'ringing';
        }

        $hasPendingInvitees = (clone $participantQuery)
            ->where('invite_status', 'invited')
            ->exists();

        if ($hasPendingInvitees) {
            return 'calling';
        }

        return 'calling';
    }

    protected function shouldFinishAfterParticipantLeft(CallRoom $callRoom): bool
    {
        $participantQuery = CallRoomParticipant::query()->where('call_room_id', $callRoom->id);

        $joinedCount = (clone $participantQuery)
            ->whereNotNull('joined_at')
            ->whereNull('left_at')
            ->count();

        $acceptedCount = (clone $participantQuery)
            ->where('invite_status', 'accepted')
            ->count();

        $hasPendingInvitees = (clone $participantQuery)
            ->whereIn('invite_status', ['invited', 'ringing'])
            ->exists();

        return $joinedCount === 0 && $acceptedCount === 0 && ! $hasPendingInvitees;
    }

    protected function canEndForAll(CallRoom $callRoom, int $userId): bool
    {
        if ($callRoom->created_by === $userId) {
            return true;
        }

        if ($callRoom->scope !== 'group') {
            return false;
        }

        $conversation = Conversation::query()->findOrFail($callRoom->conversation_id);
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);

        return in_array($membership->role, ['owner', 'admin'], true);
    }

    /**
     * @throws AuthorizationException
     */
    protected function ensureCanManageGroupRoom(CallRoom $callRoom, int $userId): void
    {
        if ($callRoom->created_by === $userId) {
            return;
        }

        if ($callRoom->scope !== 'group') {
            throw new AuthorizationException('You are not allowed to manage this call.');
        }

        $conversation = Conversation::query()->findOrFail($callRoom->conversation_id);
        $membership = $this->conversationMemberService->requireActiveMembership($conversation, $userId);

        if (! in_array($membership->role, ['owner', 'admin'], true)) {
            throw new AuthorizationException('You are not allowed to manage this call.');
        }
    }

    protected function isPastCleanupDeadline(CallRoom $callRoom, Carbon $now): bool
    {
        $referenceAt = $callRoom->updated_at ?? $callRoom->created_at ?? $now;
        $timeoutSeconds = match ($callRoom->status) {
            'calling', 'ringing' => (int) config('calls.ringing_timeout_seconds', 45),
            'connecting' => (int) config('calls.connecting_timeout_seconds', 90),
            default => null,
        };

        if ($timeoutSeconds === null) {
            return false;
        }

        return $referenceAt->copy()->addSeconds($timeoutSeconds)->lte($now);
    }

    /**
     * @return array{0: string, 1: string}
     */
    protected function resolveStaleRoomOutcome(CallRoom $callRoom): array
    {
        return match ($callRoom->status) {
            'calling', 'ringing' => ['missed', 'ring_timeout'],
            'connecting' => ['failed', 'connect_timeout'],
            default => ['failed', 'stale_call_cleanup'],
        };
    }

    protected function loadCallRoom(string $roomUuid): CallRoom
    {
        return CallRoom::query()
            ->where('room_uuid', $roomUuid)
            ->with([
                'participants.user.avatarObject',
            ])
            ->firstOrFail();
    }

    protected function lockCallRoom(string $roomUuid): CallRoom
    {
        return CallRoom::query()
            ->where('room_uuid', $roomUuid)
            ->lockForUpdate()
            ->firstOrFail();
    }

    protected function lockParticipant(int $callRoomId, int $userId): CallRoomParticipant
    {
        return CallRoomParticipant::query()
            ->where('call_room_id', $callRoomId)
            ->where('user_id', $userId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    protected function findActiveConversationCall(int $conversationId): ?CallRoom
    {
        return CallRoom::query()
            ->where('conversation_id', $conversationId)
            ->whereIn('status', CallRoom::ACTIVE_STATUSES)
            ->latest('id')
            ->first();
    }

    protected function participantIdentityToUserId(mixed $identity): ?int
    {
        if (! is_scalar($identity)) {
            return null;
        }

        $value = (string) $identity;

        return ctype_digit($value) ? (int) $value : null;
    }
}
