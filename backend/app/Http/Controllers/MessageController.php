<?php

namespace App\Http\Controllers;

use App\Http\Requests\Message\DeleteMessageRequest;
use App\Http\Requests\Message\ForwardMessageRequest;
use App\Http\Requests\Message\StoreTextMessageRequest;
use App\Http\Requests\Message\UpdateMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\Messages\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class MessageController extends Controller
{
    public function __construct(
        protected MessageService $messageService,
    ) {
    }

    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        $limit = max(1, min((int) $request->integer('limit', 50), 100));
        $cursor = $request->filled('cursor') ? (int) $request->query('cursor') : null;

        $messages = $this->messageService->listForUser(
            $conversation,
            $request->user()->getKey(),
            $cursor,
            $limit,
        );

        return response()->json([
            'data' => MessageResource::collection($messages)->resolve(),
            'meta' => [
                'next_cursor' => $messages->count() === $limit ? $messages->first()?->seq : null,
            ],
        ]);
    }

    public function storeText(StoreTextMessageRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $result = $this->messageService->sendText(
                $conversation,
                $request->user()->getKey(),
                $request->string('text')->toString(),
                $request->integer('reply_to_message_id') ?: null,
                $request->input('client_uuid'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'text' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }

    public function update(UpdateMessageRequest $request, Message $message): JsonResponse
    {
        try {
            $updatedMessage = $this->messageService->edit(
                $message,
                $request->user()->getKey(),
                $request->string('text')->toString(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'text' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new MessageResource($updatedMessage))->resolve($request),
        ]);
    }

    public function destroy(DeleteMessageRequest $request, Message $message): JsonResponse
    {
        $scope = $request->string('scope')->toString();

        if ($scope === 'self') {
            $this->messageService->deleteForSelf($message, $request->user()->getKey());

            return response()->json([
                'data' => [
                    'message_id' => $message->getKey(),
                    'scope' => 'self',
                    'status' => 'hidden',
                ],
            ]);
        }

        try {
            $updatedMessage = $this->messageService->unsendForEveryone($message, $request->user()->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'scope' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new MessageResource($updatedMessage))->resolve($request),
        ]);
    }

    public function forward(ForwardMessageRequest $request, Message $message): JsonResponse
    {
        $targetConversation = Conversation::query()->findOrFail($request->integer('target_conversation_id'));

        try {
            $result = $this->messageService->forward(
                $message->loadMissing('conversation'),
                $targetConversation,
                $request->user()->getKey(),
                $request->input('client_uuid'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'target_conversation_id' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }
}
