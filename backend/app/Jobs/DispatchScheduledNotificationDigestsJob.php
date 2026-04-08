<?php

namespace App\Jobs;

use App\Services\Notifications\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DispatchScheduledNotificationDigestsJob implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->onQueue((string) config('queue.queues.notifications', 'notifications'));
    }

    public function handle(NotificationService $notificationService): void
    {
        $notificationService->dispatchScheduledDigests();
    }
}
