<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationReactionChanged;
use App\Http\Requests\Message\StoreReactionRequest;
use App\Http\Resources\MessageReactionResource;
use App\Models\Message;
use App\Services\Messages\ReactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class ReactionController extends Controller
{
    public function __construct(
        protected ReactionService $reactionService,
    ) {
    }

    public function store(StoreReactionRequest $request, Message $message): JsonResponse
    {
        try {
            $result = $this->reactionService->addReaction(
                $message->loadMissing('conversation'),
                $request->user()->getKey(),
                $request->string('emoji')->toString(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'emoji' => [$exception->getMessage()],
                ],
            ], 422);
        }

        event(new ConversationReactionChanged(
            $message->loadMissing('conversation'),
            $result['created'] ? 'added' : 'existing',
            $request->string('emoji')->toString(),
        ));

        return response()->json([
            'data' => (new MessageReactionResource($result['reaction']))->resolve($request),
        ], $result['created'] ? 201 : 200);
    }

    public function destroy(Request $request, Message $message, string $emoji): JsonResponse
    {
        try {
            $deleted = $this->reactionService->removeReaction(
                $message->loadMissing('conversation'),
                $request->user()->getKey(),
                $emoji,
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'emoji' => [$exception->getMessage()],
                ],
            ], 422);
        }

        if ($deleted) {
            event(new ConversationReactionChanged(
                $message->loadMissing('conversation'),
                'removed',
                $emoji,
            ));
        }

        return response()->json([
            'data' => [
                'message_id' => $message->getKey(),
                'emoji' => $emoji,
                'deleted' => $deleted,
            ],
        ]);
    }
}
