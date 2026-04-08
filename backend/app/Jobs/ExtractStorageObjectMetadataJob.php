<?php

namespace App\Jobs;

use App\Models\StorageObject;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class ExtractStorageObjectMetadataJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $storageObjectId,
    ) {
    }

    public function handle(): void
    {
        $storageObject = StorageObject::query()->find($this->storageObjectId);

        if (! $storageObject || $storageObject->deleted_at) {
            return;
        }

        $disk = Storage::disk(config('uploads.disk'));

        if (! $disk->exists($storageObject->disk_path)) {
            $storageObject->forceFill([
                'transcode_status' => 'failed',
            ])->save();

            return;
        }

        $absolutePath = $disk->path($storageObject->disk_path);

        if (in_array($storageObject->media_kind, ['image', 'gif'], true)) {
            $size = @getimagesize($absolutePath);

            if ($size !== false) {
                $storageObject->forceFill([
                    'width' => $size[0] ?? null,
                    'height' => $size[1] ?? null,
                    'transcode_status' => 'ready',
                ])->save();

                return;
            }
        }

        $process = new Process([
            config('uploads.ffprobe_binary'),
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            $absolutePath,
        ]);

        $process->run();

        if (! $process->isSuccessful()) {
            $storageObject->forceFill([
                'transcode_status' => 'failed',
            ])->save();

            return;
        }

        /** @var array{streams?: array<int, array<string, mixed>>, format?: array<string, mixed>} $payload */
        $payload = json_decode($process->getOutput(), true) ?: [];
        $streams = collect($payload['streams'] ?? []);
        $videoStream = $streams->first(fn (array $stream) => ($stream['codec_type'] ?? null) === 'video');
        $durationSeconds = isset($payload['format']['duration']) ? (float) $payload['format']['duration'] : null;

        $storageObject->forceFill([
            'width' => is_array($videoStream) ? ($videoStream['width'] ?? $storageObject->width) : $storageObject->width,
            'height' => is_array($videoStream) ? ($videoStream['height'] ?? $storageObject->height) : $storageObject->height,
            'duration_ms' => $durationSeconds !== null ? (int) round($durationSeconds * 1000) : $storageObject->duration_ms,
            'transcode_status' => 'ready',
        ])->save();
    }
}
