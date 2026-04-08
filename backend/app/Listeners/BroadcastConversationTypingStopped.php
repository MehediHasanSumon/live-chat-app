<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationTypingStopped;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class BroadcastConversationTypingStopped
{
    public function handle(ConversationTypingStopped $event): void
    {
        broadcast(new ConversationRealtimeEvent(
            $event->conversation->getKey(),
            'typing.stopped',
            [
                'conversation_id' => $event->conversation->getKey(),
                'user' => (new UserResource($event->user))->resolve(new Request()),
                'device_uuid' => $event->deviceUuid,
            ],
            true,
        ))->toOthers();
    }
}
