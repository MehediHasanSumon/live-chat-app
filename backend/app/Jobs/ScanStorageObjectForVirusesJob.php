<?php

namespace App\Jobs;

use App\Models\StorageObject;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class ScanStorageObjectForVirusesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $storageObjectId,
    ) {
        $this->onQueue((string) config('queue.queues.media', 'media'));
    }

    public function handle(): void
    {
        if (! config('uploads.clamav.enabled')) {
            return;
        }

        $storageObject = StorageObject::query()->find($this->storageObjectId);

        if (! $storageObject || $storageObject->deleted_at) {
            return;
        }

        $disk = Storage::disk(config('uploads.disk'));

        if (! $disk->exists($storageObject->disk_path)) {
            $storageObject->forceFill([
                'virus_scan_status' => 'failed',
            ])->save();

            return;
        }

        $process = new Process([
            config('uploads.clamav.binary'),
            '--no-summary',
            $disk->path($storageObject->disk_path),
        ]);

        $process->run();

        $status = match ($process->getExitCode()) {
            0 => 'clean',
            1 => 'infected',
            default => 'failed',
        };

        $storageObject->forceFill([
            'virus_scan_status' => $status,
        ])->save();
    }
}
