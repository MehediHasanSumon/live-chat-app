<?php

namespace App\Http\Controllers;

use App\Http\Requests\Realtime\PresenceHeartbeatRequest;
use App\Http\Requests\Realtime\TypingRequest;
use App\Models\Conversation;
use App\Services\Realtime\PresenceService;
use App\Services\Realtime\TypingService;
use Illuminate\Http\JsonResponse;

class RealtimeController extends Controller
{
    public function __construct(
        protected PresenceService $presenceService,
        protected TypingService $typingService,
    ) {
    }

    public function heartbeat(PresenceHeartbeatRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->presenceService->heartbeat(
                $request->user()->getKey(),
                $request->string('device_uuid')->toString(),
            ),
        ]);
    }

    public function startTyping(TypingRequest $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => $this->typingService->startTyping(
                $conversation,
                $request->user(),
                $request->input('device_uuid'),
            ),
        ]);
    }

    public function stopTyping(TypingRequest $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => $this->typingService->stopTyping(
                $conversation,
                $request->user(),
                $request->input('device_uuid'),
            ),
        ]);
    }
}
