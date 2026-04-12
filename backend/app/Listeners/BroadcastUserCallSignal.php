<?php

namespace App\Listeners;

use App\Events\Broadcasts\UserRealtimeEvent;
use App\Events\Domain\UserCallSignaled;

class BroadcastUserCallSignal
{
    public function handle(UserCallSignaled $event): void
    {
        broadcast(new UserRealtimeEvent(
            $event->userId,
            $event->eventName,
            $event->payload,
        ));
    }
}
