<?php

namespace App\Http\Controllers;

use App\Http\Requests\Conversation\MarkConversationReadRequest;
use App\Http\Requests\Conversation\StoreDirectConversationRequest;
use App\Http\Requests\Conversation\UpdateConversationMuteRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Services\Conversations\ConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class ConversationController extends Controller
{
    public function __construct(
        protected ConversationService $conversationService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => ConversationResource::collection(
                $this->conversationService->listForUser($request->user()->getKey())
            )->resolve(),
        ]);
    }

    public function storeDirect(StoreDirectConversationRequest $request): JsonResponse
    {
        try {
            $conversation = $this->conversationService->getOrCreateDirect(
                $request->user()->getKey(),
                (int) $request->integer('target_user_id')
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'target_user_id' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => new ConversationResource($conversation),
        ], 201);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($request->user()->can('view', $conversation), 403);

        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->showForUser($conversation, $request->user()->getKey())
            ),
        ]);
    }

    public function archive(Request $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->archive($conversation, $request->user()->getKey())
            ),
        ]);
    }

    public function unarchive(Request $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->unarchive($conversation, $request->user()->getKey())
            ),
        ]);
    }

    public function pin(Request $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->pin($conversation, $request->user()->getKey())
            ),
        ]);
    }

    public function unpin(Request $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->unpin($conversation, $request->user()->getKey())
            ),
        ]);
    }

    public function mute(UpdateConversationMuteRequest $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->mute(
                    $conversation,
                    $request->user()->getKey(),
                    $request->input('muted_until')
                )
            ),
        ]);
    }

    public function markRead(MarkConversationReadRequest $request, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->markRead(
                    $conversation,
                    $request->user()->getKey(),
                    (int) $request->integer('last_seq')
                )
            ),
        ]);
    }
}
