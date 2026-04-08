<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationMessageDeleted;
use App\Http\Resources\MessageResource;
use Illuminate\Http\Request;

class BroadcastConversationMessageDeleted
{
    public function handle(ConversationMessageDeleted $event): void
    {
        $message = $event->message->fresh([
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $message->conversation_id,
            'message.deleted',
            [
                'message' => (new MessageResource($message))->resolve(new Request()),
            ],
        ))->toOthers();
    }
}
