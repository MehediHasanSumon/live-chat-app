<?php

namespace App\Jobs;

use App\Models\NotificationOutbox;
use App\Services\Notifications\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeliverNotificationOutboxJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $notificationOutboxId,
    ) {
        $this->onQueue((string) config('queue.queues.notifications', 'notifications'));
    }

    public function handle(NotificationService $notificationService): void
    {
        $notification = NotificationOutbox::query()->find($this->notificationOutboxId);

        if (! $notification) {
            return;
        }

        $notificationService->deliverOutbox($notification);
    }
}
