<?php

namespace App\Jobs;

use App\Services\Storage\StorageCleanupService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunStorageCleanupJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $ruleKey,
        public ?int $actorId = null,
        public bool $dryRun = false,
    ) {
        $this->onQueue((string) config('queue.queues.media', 'media'));
    }

    public function handle(StorageCleanupService $storageCleanupService): void
    {
        $storageCleanupService->run($this->ruleKey, $this->actorId, $this->dryRun);
    }
}
