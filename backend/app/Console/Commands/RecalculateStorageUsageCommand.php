<?php

namespace App\Console\Commands;

use App\Services\Storage\StorageQuotaService;
use Illuminate\Console\Command;

class RecalculateStorageUsageCommand extends Command
{
    protected $signature = 'chat:recalculate-storage';

    protected $description = 'Recalculate storage usage counters from storage objects';

    public function handle(StorageQuotaService $storageQuotaService): int
    {
        $counter = $storageQuotaService->recalculateUsage();

        $this->info(sprintf(
            'Storage recalculated. objects=%d live_bytes=%d deleted_bytes_total=%d',
            $counter->live_object_count,
            $counter->live_bytes,
            $counter->deleted_bytes_total,
        ));

        return self::SUCCESS;
    }
}
