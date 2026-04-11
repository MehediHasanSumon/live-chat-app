<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageDeleted;
use App\Events\Domain\ConversationMessageUpdated;
use App\Http\Requests\Message\DeleteMessageRequest;
use App\Http\Requests\Message\ForwardMessageRequest;
use App\Http\Requests\Message\StoreGifMessageRequest;
use App\Http\Requests\Message\StoreMediaMessageRequest;
use App\Http\Requests\Message\StoreTextMessageRequest;
use App\Http\Requests\Message\StoreVoiceMessageRequest;
use App\Http\Requests\Message\UpdateMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\Messages\MessageService;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class MessageController extends Controller
{
    public function __construct(
        protected MessageService $messageService,
        protected NotificationService $notificationService,
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

        if ($result['created']) {
            event(new ConversationMessageCreated($result['message']));
            $this->notificationService->queueMessagePush($result['message']);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }

    public function storeVoice(StoreVoiceMessageRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $result = $this->messageService->sendVoice(
                $conversation,
                $request->user()->getKey(),
                (int) $request->integer('storage_object_id'),
                (int) $request->integer('duration_ms'),
                $request->input('waveform'),
                $request->input('client_uuid'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'storage_object_id' => [$exception->getMessage()],
                ],
            ], 422);
        }

        if ($result['created']) {
            event(new ConversationMessageCreated($result['message']));
            $this->notificationService->queueMessagePush($result['message']);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }

    public function storeMedia(StoreMediaMessageRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $result = $this->messageService->sendMedia(
                $conversation,
                $request->user()->getKey(),
                $request->array('storage_object_ids'),
                $request->input('caption'),
                $request->input('client_uuid'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'storage_object_ids' => [$exception->getMessage()],
                ],
            ], 422);
        }

        if ($result['created']) {
            event(new ConversationMessageCreated($result['message']));
            $this->notificationService->queueMessagePush($result['message']);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }

    public function storeGif(StoreGifMessageRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $result = $this->messageService->sendGif(
                $conversation,
                $request->user()->getKey(),
                $request->array('gif_meta'),
                $request->input('client_uuid'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'gif_meta' => [$exception->getMessage()],
                ],
            ], 422);
        }

        if ($result['created']) {
            event(new ConversationMessageCreated($result['message']));
            $this->notificationService->queueMessagePush($result['message']);
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

        event(new ConversationMessageUpdated($updatedMessage));

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

        event(new ConversationMessageDeleted($updatedMessage));

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

        if ($result['created']) {
            event(new ConversationMessageCreated($result['message']));
            $this->notificationService->queueMessagePush($result['message']);
        }

        return response()->json([
            'data' => (new MessageResource($result['message']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }
}
