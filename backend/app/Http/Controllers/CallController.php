<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationCallStateChanged;
use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageUpdated;
use App\Http\Requests\Call\EndCallRequest;
use App\Http\Requests\Call\IssueJoinTokenRequest;
use App\Http\Resources\CallRoomResource;
use App\Models\CallRoom;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Calls\CallService;
use App\Services\Notifications\NotificationService;
use App\Services\Realtime\UserRealtimeSignalService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class CallController extends Controller
{
    public function __construct(
        protected CallService $callService,
        protected NotificationService $notificationService,
        protected UserRealtimeSignalService $userRealtimeSignalService,
    ) {
    }

    public function startDirect(Request $request, User $user, string $mediaType): JsonResponse
    {
        try {
            $payload = $this->callService->startDirect(
                $request->user()->getKey(),
                $user->getKey(),
                $mediaType,
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout($payload['call_room'], 'calling', $payload['notify_user_ids'], 'call.incoming');
        $this->dispatchCallFanout(
            $payload['call_room'],
            $this->callService->resolveRealtimeAction($payload['call_room'], 'calling'),
            $this->participantUserIds($payload['call_room']),
            'call.state.changed',
        );
        $this->notificationService->queueCallInvite($payload['call_room'], $payload['notify_user_ids']);
        $payload['call_room'] = $this->callService->markRinging($payload['call_room']);
        $this->dispatchCallFanout(
            $payload['call_room'],
            $this->callService->resolveRealtimeAction($payload['call_room'], 'ringing'),
            $this->participantUserIds($payload['call_room']),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($payload['call_room']))->resolve($request),
        ], 201);
    }

    public function startGroup(Request $request, Conversation $conversation, string $mediaType): JsonResponse
    {
        try {
            $payload = $this->callService->startGroup(
                $conversation,
                $request->user()->getKey(),
                $mediaType,
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout($payload['call_room'], 'calling', $payload['notify_user_ids'], 'call.incoming');
        $this->dispatchCallFanout(
            $payload['call_room'],
            $this->callService->resolveRealtimeAction($payload['call_room'], 'calling'),
            $this->participantUserIds($payload['call_room']),
            'call.state.changed',
        );
        $this->notificationService->queueCallInvite($payload['call_room'], $payload['notify_user_ids']);
        $payload['call_room'] = $this->callService->markRinging($payload['call_room']);
        $this->dispatchCallFanout(
            $payload['call_room'],
            $this->callService->resolveRealtimeAction($payload['call_room'], 'ringing'),
            $this->participantUserIds($payload['call_room']),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($payload['call_room']))->resolve($request),
        ], 201);
    }

    public function show(Request $request, CallRoom $callRoom): JsonResponse
    {
        if (! $callRoom->participants()->where('user_id', $request->user()->getKey())->exists()) {
            abort(404);
        }

        $callRoom->loadMissing([
            'participants.user',
        ]);

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function accept(Request $request, CallRoom $callRoom): JsonResponse
    {
        $actorUserId = $request->user()->getKey();
        $currentRoom = CallRoom::query()
            ->whereKey($callRoom->getKey())
            ->with(['participants'])
            ->firstOrFail();
        $currentParticipant = $currentRoom->participants
            ->firstWhere('user_id', $actorUserId);

        if ($currentRoom->is_locked && $currentParticipant?->invite_status !== 'accepted') {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => ['This call is locked and cannot accept new participants.'],
                ],
            ], 422);
        }

        try {
            $callRoom = $this->callService->accept($callRoom, $actorUserId);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $actorParticipant = $callRoom->participants
            ->firstWhere('user_id', $actorUserId);

        if ($callRoom->is_locked && $actorParticipant?->invite_status !== 'accepted') {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => ['This call is locked and cannot accept new participants.'],
                ],
            ], 422);
        }

        $this->dispatchCallFanout(
            $callRoom,
            $this->callService->resolveRealtimeAction($callRoom, 'connecting'),
            $this->participantUserIds($callRoom),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function decline(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->decline($callRoom, $request->user()->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout(
            $callRoom,
            $this->callService->resolveRealtimeAction($callRoom, 'declined'),
            $this->participantUserIds($callRoom),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function end(EndCallRequest $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->end(
                $callRoom,
                $request->user()->getKey(),
                $request->input('reason'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout(
            $callRoom,
            $this->callService->resolveRealtimeAction($callRoom, 'ended'),
            $this->participantUserIds($callRoom),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function endForAll(EndCallRequest $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->endForAll(
                $callRoom,
                $request->user()->getKey(),
                $request->input('reason'),
            );
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout(
            $callRoom,
            $this->callService->resolveRealtimeAction($callRoom, 'ended'),
            $this->participantUserIds($callRoom),
            'call.state.changed',
        );

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function lock(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->lockRoom($callRoom, $request->user()->getKey());
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallStateUpdate($callRoom, 'locked');

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function unlock(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->unlockRoom($callRoom, $request->user()->getKey());
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallStateUpdate($callRoom, 'unlocked');

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function removeParticipant(Request $request, CallRoom $callRoom, User $user): JsonResponse
    {
        try {
            $callRoom = $this->callService->removeParticipant(
                $callRoom,
                $request->user()->getKey(),
                $user->getKey(),
                $request->string('reason')->toString() ?: null,
            );
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallStateUpdate($callRoom, 'participant_removed');

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
        ]);
    }

    public function muteAll(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $payload = $this->callService->muteAll($callRoom, $request->user()->getKey());
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        foreach ($payload['notify_user_ids'] as $userId) {
            $this->userRealtimeSignalService->dispatchCallSignal((int) $userId, 'call.mute.requested', [
                'room_uuid' => $payload['call_room']->room_uuid,
                'actor_user_id' => $request->user()->getKey(),
            ]);
        }

        return response()->json([
            'data' => (new CallRoomResource($payload['call_room']))->resolve($request),
        ]);
    }

    public function inviteParticipants(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $payload = $this->callService->inviteParticipants(
                $callRoom,
                $request->user()->getKey(),
                $request->input('user_ids', []),
            );
        } catch (AuthorizationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 403);
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        if (! empty($payload['notify_user_ids'])) {
            $this->dispatchCallFanout($payload['call_room'], 'ringing', $payload['notify_user_ids'], 'call.incoming');
        }

        $this->dispatchCallStateUpdate($payload['call_room'], 'ringing');
        $this->notificationService->queueCallInvite($payload['call_room'], $payload['notify_user_ids']);

        return response()->json([
            'data' => (new CallRoomResource($payload['call_room']))->resolve($request),
        ]);
    }

    public function joinToken(IssueJoinTokenRequest $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $payload = $this->callService->issueJoinToken(
                $callRoom,
                $request->user(),
                (bool) $request->boolean('wants_video'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        event(new ConversationCallStateChanged(
            $payload['call_room'],
            $this->callService->resolveRealtimeAction($payload['call_room'], 'connecting'),
        ));

        return response()->json([
            'data' => [
                'call_room' => (new CallRoomResource($payload['call_room']))->resolve($request),
                'publish_mode' => $payload['publish_mode'],
                'token' => $payload['token'],
            ],
        ]);
    }

    protected function dispatchCallFanout(CallRoom $callRoom, string $action, array $notifyUserIds, string $userEvent): void
    {
        event(new ConversationCallStateChanged($callRoom, $action));
        $callMessage = $this->callService->syncCallHistoryMessage($callRoom, $action, request()->user()?->getKey());

        if ($callMessage['created']) {
            event(new ConversationMessageCreated($callMessage['message']));
        } else {
            event(new ConversationMessageUpdated($callMessage['message']));
        }

        $payload = [
            'action' => $action,
            'call_room' => (new CallRoomResource($callRoom))->resolve(request()),
        ];

        foreach (array_unique($notifyUserIds) as $userId) {
            $this->userRealtimeSignalService->dispatchCallSignal((int) $userId, $userEvent, $payload);
        }
    }

    protected function dispatchCallStateUpdate(CallRoom $callRoom, string $fallbackAction = 'updated'): void
    {
        $action = $this->callService->resolveRealtimeAction($callRoom, $fallbackAction);
        event(new ConversationCallStateChanged($callRoom, $action));

        $payload = [
            'action' => $action,
            'call_room' => (new CallRoomResource($callRoom))->resolve(request()),
        ];

        foreach (array_unique($this->participantUserIds($callRoom)) as $userId) {
            $this->userRealtimeSignalService->dispatchCallSignal((int) $userId, 'call.state.changed', $payload);
        }
    }

    /**
     * @return array<int>
     */
    protected function participantUserIds(CallRoom $callRoom): array
    {
        return $callRoom->participants
            ->pluck('user_id')
            ->map(static fn ($id) => (int) $id)
            ->values()
            ->all();
    }
}
