<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationMessageUpdated;
use App\Http\Resources\MessageResource;
use Illuminate\Http\Request;

class BroadcastConversationMessageUpdated
{
    public function handle(ConversationMessageUpdated $event): void
    {
        $message = $event->message->fresh([
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $message->conversation_id,
            'message.updated',
            [
                'message' => (new MessageResource($message))->resolve(new Request()),
            ],
        ))->toOthers();
    }
}
