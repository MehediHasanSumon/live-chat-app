<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationReactionChanged;
use App\Http\Resources\MessageReactionResource;

class BroadcastConversationReactionChanged
{
    public function handle(ConversationReactionChanged $event): void
    {
        $message = $event->message->fresh([
            'reactions.user',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $message->conversation_id,
            'reaction.changed',
            [
                'message_id' => $message->id,
                'action' => $event->action,
                'emoji' => $event->emoji,
                'reactions' => MessageReactionResource::collection($message->reactions)->resolve(),
            ],
        ))->toOthers();
    }
}
