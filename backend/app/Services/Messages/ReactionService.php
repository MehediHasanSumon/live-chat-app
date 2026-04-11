<?php

namespace App\Services\Messages;

use App\Models\Message;
use App\Models\MessageReaction;
use App\Services\Conversations\ConversationMemberService;
use App\Services\Privacy\PrivacyService;
use Illuminate\Support\Facades\DB;

class ReactionService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
        protected PrivacyService $privacyService,
    ) {
    }

    /**
     * @return array{reaction: MessageReaction, created: bool}
     */
    public function addReaction(Message $message, int $userId, string $emoji): array
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $userId);
        $this->privacyService->ensureChatAllowed($userId, $message->conversation);

        $result = DB::transaction(function () use ($emoji, $message, $userId): array {
            $existingReactions = MessageReaction::query()
                ->where('message_id', $message->getKey())
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->get();

            $matchingReaction = $existingReactions
                ->first(fn (MessageReaction $reaction) => $reaction->emoji === $emoji);

            if ($matchingReaction) {
                MessageReaction::query()
                    ->where('message_id', $message->getKey())
                    ->where('user_id', $userId)
                    ->whereKeyNot($matchingReaction->getKey())
                    ->delete();

                return [
                    'reaction' => $matchingReaction,
                    'created' => false,
                ];
            }

            $existingReaction = $existingReactions->first();

            if ($existingReaction) {
                $existingReaction->forceFill([
                    'emoji' => $emoji,
                ])->save();

                MessageReaction::query()
                    ->where('message_id', $message->getKey())
                    ->where('user_id', $userId)
                    ->whereKeyNot($existingReaction->getKey())
                    ->delete();

                return [
                    'reaction' => $existingReaction,
                    'created' => false,
                ];
            }

            return [
                'reaction' => MessageReaction::query()->create([
                    'message_id' => $message->getKey(),
                    'user_id' => $userId,
                    'emoji' => $emoji,
                    'created_at' => now(),
                ]),
                'created' => true,
            ];
        });

        return [
            'reaction' => $result['reaction']->load('user'),
            'created' => $result['created'],
        ];
    }

    public function removeReaction(Message $message, int $userId, string $emoji): bool
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $userId);
        $this->privacyService->ensureChatAllowed($userId, $message->conversation);

        return MessageReaction::query()
            ->where('message_id', $message->getKey())
            ->where('user_id', $userId)
            ->where('emoji', $emoji)
            ->delete() > 0;
    }
}
