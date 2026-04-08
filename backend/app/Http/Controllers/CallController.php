<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationCallStateChanged;
use App\Http\Requests\Call\EndCallRequest;
use App\Http\Requests\Call\IssueJoinTokenRequest;
use App\Http\Resources\CallRoomResource;
use App\Models\CallRoom;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Calls\CallService;
use App\Services\Notifications\NotificationService;
use App\Services\Realtime\UserRealtimeSignalService;
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

        $this->dispatchCallFanout($payload['call_room'], 'started', $payload['notify_user_ids'], 'call.incoming');
        $this->notificationService->queueCallInvite($payload['call_room'], $payload['notify_user_ids']);

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

        $this->dispatchCallFanout($payload['call_room'], 'started', $payload['notify_user_ids'], 'call.incoming');
        $this->notificationService->queueCallInvite($payload['call_room'], $payload['notify_user_ids']);

        return response()->json([
            'data' => (new CallRoomResource($payload['call_room']))->resolve($request),
        ], 201);
    }

    public function accept(Request $request, CallRoom $callRoom): JsonResponse
    {
        try {
            $callRoom = $this->callService->accept($callRoom, $request->user()->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'call' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $this->dispatchCallFanout($callRoom, 'accepted', $this->participantUserIds($callRoom), 'call.state.changed');

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

        $this->dispatchCallFanout($callRoom, 'declined', $this->participantUserIds($callRoom), 'call.state.changed');

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

        $this->dispatchCallFanout($callRoom, 'ended', $this->participantUserIds($callRoom), 'call.state.changed');

        return response()->json([
            'data' => (new CallRoomResource($callRoom))->resolve($request),
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

        event(new ConversationCallStateChanged($payload['call_room'], 'join_token_issued'));

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

        $payload = [
            'action' => $action,
            'call_room' => (new CallRoomResource($callRoom))->resolve(request()),
        ];

        foreach (array_unique($notifyUserIds) as $userId) {
            $this->userRealtimeSignalService->dispatchCallSignal((int) $userId, $userEvent, $payload);
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
