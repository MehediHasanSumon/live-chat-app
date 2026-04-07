<?php

namespace App\Http\Controllers;

use App\Services\LiveKit\LiveKitRoomService;
use App\Services\LiveKit\LiveKitTokenService;
use App\Services\LiveKit\LiveKitWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

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

    public function webhook(Request $request, LiveKitWebhookService $webhookService): JsonResponse
    {
        $event = $webhookService->parse($request);

        Log::info('livekit.webhook.received', [
            'event' => $event['event'] ?? null,
            'room' => $event['room']['name'] ?? null,
            'participant' => $event['participant']['identity'] ?? null,
        ]);

        return response()->json([
            'received' => true,
            'event' => $event['event'] ?? null,
        ]);
    }
}
