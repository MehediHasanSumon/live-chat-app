<?php

namespace App\Console\Commands;

use App\Services\Storage\StorageCleanupService;
use Illuminate\Console\Command;

class CleanupSmallFilesCommand extends Command
{
    protected $signature = 'chat:cleanup-small-files {--dry-run}';

    protected $description = 'Clean up small files that passed the retention window';

    public function handle(StorageCleanupService $storageCleanupService): int
    {
        $run = $storageCleanupService->run('small_after_30d', null, (bool) $this->option('dry-run'));

        $this->info(sprintf(
            'Cleanup completed. scanned=%d deleted=%d bytes=%d dry_run=%s',
            $run->objects_scanned,
            $run->objects_deleted,
            $run->bytes_freed,
            $run->dry_run ? 'yes' : 'no',
        ));

        return self::SUCCESS;
    }
}
