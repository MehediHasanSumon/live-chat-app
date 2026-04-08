<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationCallStateChanged;
use App\Http\Resources\CallRoomResource;
use Illuminate\Http\Request;

class BroadcastConversationCallStateChanged
{
    public function handle(ConversationCallStateChanged $event): void
    {
        $callRoom = $event->callRoom->fresh([
            'participants.user',
        ]);

        broadcast(new ConversationRealtimeEvent(
            $callRoom->conversation_id,
            'call.state.changed',
            [
                'action' => $event->action,
                'call_room' => (new CallRoomResource($callRoom))->resolve(new Request()),
            ],
        ))->toOthers();
    }
}
