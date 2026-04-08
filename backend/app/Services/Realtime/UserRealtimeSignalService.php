<?php

namespace App\Services\Realtime;

use App\Events\Domain\UserCallSignaled;
use App\Events\Domain\UserNotificationDispatched;

class UserRealtimeSignalService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatchNotification(int $userId, string $eventName, array $payload = []): void
    {
        event(new UserNotificationDispatched($userId, $eventName, $payload));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatchCallSignal(int $userId, string $eventName, array $payload = []): void
    {
        event(new UserCallSignaled($userId, $eventName, $payload));
    }
}
