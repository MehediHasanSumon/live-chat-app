<?php

namespace App\Http\Controllers;

use App\Events\Domain\ConversationReactionChanged;
use App\Http\Requests\Message\StoreReactionRequest;
use App\Http\Resources\MessageReactionResource;
use App\Models\Message;
use App\Services\Messages\ReactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReactionController extends Controller
{
    public function __construct(
        protected ReactionService $reactionService,
    ) {
    }

    public function store(StoreReactionRequest $request, Message $message): JsonResponse
    {
        $result = $this->reactionService->addReaction(
            $message->loadMissing('conversation'),
            $request->user()->getKey(),
            $request->string('emoji')->toString(),
        );

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
        $deleted = $this->reactionService->removeReaction(
            $message->loadMissing('conversation'),
            $request->user()->getKey(),
            $emoji,
        );

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
