<?php

namespace App\Services\Messages;

use App\Models\Message;
use App\Models\MessageReaction;
use App\Services\Conversations\ConversationMemberService;

class ReactionService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    /**
     * @return array{reaction: MessageReaction, created: bool}
     */
    public function addReaction(Message $message, int $userId, string $emoji): array
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $userId);

        $existing = MessageReaction::query()
            ->where('message_id', $message->getKey())
            ->where('user_id', $userId)
            ->where('emoji', $emoji)
            ->first();

        if ($existing) {
            return [
                'reaction' => $existing->load('user'),
                'created' => false,
            ];
        }

        $reaction = MessageReaction::query()->create([
            'message_id' => $message->getKey(),
            'user_id' => $userId,
            'emoji' => $emoji,
            'created_at' => now(),
        ]);

        return [
            'reaction' => $reaction->load('user'),
            'created' => true,
        ];
    }

    public function removeReaction(Message $message, int $userId, string $emoji): bool
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $userId);

        return MessageReaction::query()
            ->where('message_id', $message->getKey())
            ->where('user_id', $userId)
            ->where('emoji', $emoji)
            ->delete() > 0;
    }
}
