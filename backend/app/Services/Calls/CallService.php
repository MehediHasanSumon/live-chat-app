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
use App\Services\Privacy\PrivacyService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        protected PrivacyService $privacyService,
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

            if (in_array($lockedRoom->status, ['ended', 'declined', 'cancelled', 'failed', 'missed'], true)) {
                throw new InvalidArgumentException('This call is no longer active.');
            }

            $participant = $this->lockParticipant($lockedRoom->id, $userId);

            $participant->forceFill([
                'invite_status' => 'accepted',
            ])->save();

            $lockedRoom->forceFill([
                'status' => 'active',
                'started_at' => $lockedRoom->started_at ?? now(),
            ])->save();

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    public function decline(CallRoom $callRoom, int $userId): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (in_array($lockedRoom->status, ['ended', 'declined', 'cancelled', 'failed', 'missed'], true)) {
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
            }

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    public function end(CallRoom $callRoom, int $userId, ?string $reason = null): CallRoom
    {
        $updatedRoom = DB::transaction(function () use ($callRoom, $reason, $userId): CallRoom {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);
            $this->lockParticipant($lockedRoom->id, $userId);

            if (! in_array($lockedRoom->status, CallRoom::ACTIVE_STATUSES, true)) {
                return $lockedRoom;
            }

            $this->finishLockedRoom($lockedRoom, 'ended', $reason ?: 'ended_by_participant');

            return $lockedRoom;
        });

        return $this->loadCallRoom($updatedRoom->room_uuid);
    }

    /**
     * @return array{call_room: CallRoom, token: array<string, mixed>, publish_mode: string}
     */
    public function issueJoinToken(CallRoom $callRoom, User $user, bool $wantsVideo = false): array
    {
        $payload = DB::transaction(function () use ($callRoom, $user, $wantsVideo): array {
            $lockedRoom = $this->lockCallRoom($callRoom->room_uuid);

            if (! in_array($lockedRoom->status, ['ringing', 'active', 'initiated'], true)) {
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
                'call_room' => $this->syncParticipantJoined($roomUuid, $payload),
                'action' => 'participant_joined',
            ],
            'participant_left' => [
                'call_room' => $this->syncParticipantLeft($roomUuid, $payload),
                'action' => 'participant_left',
            ],
            'room_finished' => [
                'call_room' => $this->syncRoomFinished($roomUuid),
                'action' => 'room_finished',
            ],
            'room_started' => [
                'call_room' => $this->syncRoomStarted($roomUuid),
                'action' => 'room_started',
            ],
            default => [
                'call_room' => $this->touchWebhookTimestamp($roomUuid),
                'action' => 'webhook_received',
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

        $callRoom = DB::transaction(function () use ($callerId, $conversation, $mediaType, $participants, $roomUuid, $scope): CallRoom {
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
                'status' => 'ringing',
                'max_participants' => $participants->count(),
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
                        : ($scope === 'direct' ? 'ringing' : 'invited'),
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

            $lockedRoom->forceFill([
                'status' => 'active',
                'started_at' => $lockedRoom->started_at ?? now(),
                'last_webhook_at' => now(),
            ])->save();

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
                    'invite_status' => 'left',
                    'left_at' => now(),
                    'left_reason' => is_string($reason) ? Str::limit($reason, 60, '') : 'participant_left',
                ])->save();
            }

            $lockedRoom->forceFill([
                'last_webhook_at' => now(),
            ])->save();

            $hasConnectedParticipants = CallRoomParticipant::query()
                ->where('call_room_id', $lockedRoom->id)
                ->whereNotNull('joined_at')
                ->whereNull('left_at')
                ->exists();

            if (! $hasConnectedParticipants) {
                $this->finishLockedRoom($lockedRoom, 'ended', 'participants_left');
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

            $lockedRoom->forceFill([
                'status' => 'active',
                'started_at' => $lockedRoom->started_at ?? now(),
                'last_webhook_at' => now(),
            ])->save();

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
        $callRoom->forceFill([
            'status' => $status,
            'ended_at' => $callRoom->ended_at ?? now(),
            'ended_reason' => Str::limit($endedReason, 60, ''),
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
    }

    protected function loadCallRoom(string $roomUuid): CallRoom
    {
        return CallRoom::query()
            ->where('room_uuid', $roomUuid)
            ->with([
                'participants.user',
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
