<?php

namespace App\Listeners;

use App\Events\Broadcasts\UserRealtimeEvent;
use App\Events\Domain\UserNotificationDispatched;

class BroadcastUserNotification
{
    public function handle(UserNotificationDispatched $event): void
    {
        broadcast(new UserRealtimeEvent(
            $event->userId,
            $event->eventName,
            $event->payload,
        ))->toOthers();
    }
}
