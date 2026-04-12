<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationCallStateChanged;
use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageUpdated;
use App\Services\Calls\CallService;
use App\Http\Resources\CallRoomResource;
use App\Services\LiveKit\LiveKitRoomService;
use App\Services\LiveKit\LiveKitTokenService;
use App\Services\LiveKit\LiveKitWebhookService;
use App\Services\Realtime\UserRealtimeSignalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

class LiveKitController extends Controller
{
    public function token(Request $request, LiveKitTokenService $tokenService): JsonResponse
    {
        $payload = $request->validate([
            'room' => ['required', 'string', 'max:255'],
            'can_publish' => ['sometimes', 'boolean'],
            'can_subscribe' => ['sometimes', 'boolean'],
            'can_publish_data' => ['sometimes', 'boolean'],
            'can_update_own_metadata' => ['sometimes', 'boolean'],
            'can_publish_sources' => ['sometimes', 'array'],
            'can_publish_sources.*' => ['string', Rule::in([
                ...config('livekit.allowed_publish_sources'),
            ])],
        ]);

        return response()->json(
            $tokenService->issueJoinToken($request->user(), $payload['room'], $payload)
        );
    }

    public function createRoom(Request $request, LiveKitRoomService $roomService): JsonResponse
    {
        $maxParticipants = (int) config('livekit.default_room_max_participants');

        $payload = $request->validate([
            'room' => ['required', 'string', 'max:255'],
            'empty_timeout' => ['sometimes', 'integer', 'min:0'],
            'max_participants' => ['sometimes', 'integer', 'min:1', 'max:'.$maxParticipants],
        ]);

        return response()->json([
            'room' => $roomService->createRoom($payload['room'], $payload),
        ]);
    }

    public function listRooms(LiveKitRoomService $roomService): JsonResponse
    {
        return response()->json([
            'rooms' => $roomService->listRooms(),
        ]);
    }

    public function webhook(
        Request $request,
        LiveKitWebhookService $webhookService,
        CallService $callService,
        UserRealtimeSignalService $userRealtimeSignalService,
    ): JsonResponse
    {
        try {
            $event = $webhookService->parse($request);
        } catch (Throwable $exception) {
            Log::warning('livekit.webhook.invalid_signature', [
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Invalid LiveKit webhook signature.',
            ], 401);
        }

        $result = $callService->handleWebhook($event);

        Log::info('livekit.webhook.received', [
            'event' => $event['event'] ?? null,
            'room' => $event['room']['name'] ?? null,
            'participant' => $event['participant']['identity'] ?? null,
        ]);

        if ($result['call_room']) {
            $action = $result['action'] ?? $callService->resolveRealtimeAction($result['call_room'], 'updated');

            event(new ConversationCallStateChanged($result['call_room'], $action));
            $callMessage = $callService->syncCallHistoryMessage($result['call_room'], $action);

            if ($callMessage['created']) {
                event(new ConversationMessageCreated($callMessage['message']));
            } else {
                event(new ConversationMessageUpdated($callMessage['message']));
            }

            foreach ($result['call_room']->participants->pluck('user_id')->unique() as $userId) {
                $userRealtimeSignalService->dispatchCallSignal((int) $userId, 'call.state.changed', [
                    'action' => $action,
                    'call_room' => (new CallRoomResource($result['call_room']))->resolve($request),
                ]);
            }
        }

        return response()->json([
            'received' => true,
            'event' => $event['event'] ?? null,
            'call_room' => $result['call_room']?->room_uuid,
        ]);
    }
}
