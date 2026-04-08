<?php

namespace App\Http\Controllers;

use App\Http\Requests\Conversation\StoreGroupConversationRequest;
use App\Http\Requests\Conversation\UpdateGroupConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Services\Conversations\ConversationService;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class GroupController extends Controller
{
    public function __construct(
        protected ConversationService $conversationService,
    ) {
    }

    public function store(StoreGroupConversationRequest $request): JsonResponse
    {
        try {
            $conversation = $this->conversationService->createGroup(
                $request->user()->getKey(),
                $request->array('member_ids'),
                $request->validated()
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'member_ids' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => new ConversationResource($conversation),
        ], 201);
    }

    public function update(UpdateGroupConversationRequest $request, Conversation $conversation): JsonResponse
    {
        abort_unless($request->user()->can('manageGroup', $conversation), 403);

        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->updateGroup(
                    $conversation,
                    $request->user()->getKey(),
                    $request->validated()
                )
            ),
        ]);
    }
}
