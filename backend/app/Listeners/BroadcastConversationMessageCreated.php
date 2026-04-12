<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationMessageCreated;
use App\Http\Resources\MessageResource;
use Illuminate\Http\Request;

class BroadcastConversationMessageCreated
{
    public function handle(ConversationMessageCreated $event): void
    {
        $message = $event->message->fresh([
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $message->conversation_id,
            'message.created',
            [
                'message' => (new MessageResource($message))->resolve(new Request()),
            ],
        ));
    }
}
