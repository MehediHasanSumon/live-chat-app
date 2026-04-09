<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationReadStateUpdated;
use App\Http\Resources\ConversationResource;
use Illuminate\Http\Request;

class BroadcastConversationReadStateUpdated
{
    public function handle(ConversationReadStateUpdated $event): void
    {
        $conversation = $event->conversation->fresh([
            'creator',
            'avatarObject',
            'lastMessage.sender',
            'members.user',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $conversation->getKey(),
            'conversation.read',
            [
                'conversation_id' => $conversation->getKey(),
                'user_id' => $event->userId,
                'last_read_seq' => $event->lastReadSeq,
                'conversation' => (new ConversationResource($conversation))->resolve(new Request()),
            ],
        ))->toOthers();
    }
}
