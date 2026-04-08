<?php

namespace App\Console\Commands;

use App\Services\Notifications\NotificationService;
use Illuminate\Console\Command;

class DispatchScheduledDigestsCommand extends Command
{
    protected $signature = 'chat:dispatch-scheduled-digests';

    protected $description = 'Dispatch queued scheduled notification digests that are due.';

    public function handle(NotificationService $notificationService): int
    {
        $count = $notificationService->dispatchScheduledDigests();

        $this->info("Dispatched {$count} scheduled digest notifications.");

        return self::SUCCESS;
    }
}
