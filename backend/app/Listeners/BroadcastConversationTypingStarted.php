<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Domain\ConversationTypingStarted;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class BroadcastConversationTypingStarted
{
    public function handle(ConversationTypingStarted $event): void
    {
        broadcast(new ConversationRealtimeEvent(
            $event->conversation->getKey(),
            'typing.started',
            [
                'conversation_id' => $event->conversation->getKey(),
                'user' => (new UserResource($event->user))->resolve(new Request()),
                'device_uuid' => $event->deviceUuid,
            ],
            true,
        ))->toOthers();
    }
}
