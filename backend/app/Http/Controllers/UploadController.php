<?php

namespace App\Http\Controllers;

use App\Http\Requests\Storage\AttachUploadRequest;
use App\Http\Requests\Storage\StoreUploadRequest;
use App\Http\Resources\MessageAttachmentResource;
use App\Http\Resources\MessageResource;
use App\Http\Resources\StorageObjectResource;
use App\Models\Message;
use App\Models\StorageObject;
use App\Services\Storage\StorageObjectService;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadController extends Controller
{
    public function __construct(
        protected StorageObjectService $storageObjectService,
    ) {
    }

    public function store(StoreUploadRequest $request): JsonResponse
    {
        try {
            $storageObject = $this->storageObjectService->storeUpload(
                $request->file('file'),
                $request->user()->getKey(),
                $request->input('purpose', 'message_attachment'),
                $request->input('media_kind_hint'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'file' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new StorageObjectResource($storageObject))->resolve($request),
        ], 201);
    }

    public function attach(AttachUploadRequest $request, StorageObject $storageObject): JsonResponse
    {
        $message = Message::query()->with(['conversation'])->findOrFail($request->integer('message_id'));

        try {
            $attachment = $this->storageObjectService->attachToMessage(
                $storageObject,
                $message,
                $request->user()->getKey(),
                (int) $request->integer('display_order', 1),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'message_id' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $message->load([
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        return response()->json([
            'data' => [
                'attachment' => (new MessageAttachmentResource($attachment))->resolve($request),
                'message' => (new MessageResource($message))->resolve($request),
            ],
        ]);
    }

    public function download(Request $request, string $objectUuid): StreamedResponse|Response
    {
        $storageObject = $this->storageObjectService->findAccessibleObjectByUuid($objectUuid);

        abort_unless($this->storageObjectService->canDownloadObject($storageObject), 404);

        if ($this->shouldStreamMediaInline($storageObject->mime_type)) {
            return $this->streamMediaResponse(
                $request,
                $storageObject->disk_path,
                $storageObject->original_name ?: basename($storageObject->disk_path),
                $storageObject->mime_type ?: 'application/octet-stream',
            );
        }

        return Storage::disk(config('uploads.disk'))->download(
            $storageObject->disk_path,
            $storageObject->original_name,
            [
                'Content-Type' => $storageObject->mime_type,
            ],
        );
    }

    protected function shouldStreamMediaInline(?string $mimeType): bool
    {
        if (! is_string($mimeType) || $mimeType === '') {
            return false;
        }

        return str_starts_with($mimeType, 'audio/') || str_starts_with($mimeType, 'video/');
    }

    protected function streamMediaResponse(
        Request $request,
        string $filePath,
        string $filename,
        string $mimeType,
    ): StreamedResponse|Response {
        $disk = Storage::disk(config('uploads.disk'));
        $fileSize = $disk->size($filePath);
        $range = $this->parseRangeHeader($request->header('Range'), $fileSize);

        if ($range !== null) {
            return $this->streamPartialMediaResponse(
                $filePath,
                $filename,
                $mimeType,
                $range['start'],
                $range['end'],
            );
        }

        return response()->stream(function () use ($disk, $filePath) {
            $stream = $disk->readStream($filePath);

            while (is_resource($stream) && ! feof($stream)) {
                echo fread($stream, 8192);
                flush();
            }

            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => sprintf('inline; filename="%s"', addslashes($filename)),
            'Content-Length' => (string) $fileSize,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=60',
        ]);
    }

    protected function streamPartialMediaResponse(
        string $filePath,
        string $filename,
        string $mimeType,
        int $rangeStart,
        int $rangeEnd,
    ): StreamedResponse|Response {
        $disk = Storage::disk(config('uploads.disk'));
        $fileSize = $disk->size($filePath);

        if ($rangeStart >= $fileSize || $rangeStart < 0) {
            return response('Invalid range', 416, [
                'Content-Range' => "bytes */{$fileSize}",
            ]);
        }

        $safeRangeEnd = min($rangeEnd, $fileSize - 1);
        $stream = $disk->readStream($filePath);

        if (! is_resource($stream)) {
            abort(404);
        }

        fseek($stream, $rangeStart);

        $response = response()->stream(function () use ($stream, $rangeStart, $safeRangeEnd) {
            $chunkSize = 8192;
            $bytesRead = 0;
            $totalBytes = $safeRangeEnd - $rangeStart + 1;

            while ($bytesRead < $totalBytes && ! feof($stream)) {
                $remaining = $totalBytes - $bytesRead;
                $toRead = min($chunkSize, $remaining);
                echo fread($stream, $toRead);
                $bytesRead += $toRead;
                flush();
            }

            fclose($stream);
        }, 206);

        $response->headers->set('Content-Type', $mimeType);
        $response->headers->set('Content-Disposition', sprintf('inline; filename="%s"', addslashes($filename)));
        $response->headers->set('Content-Length', (string) ($safeRangeEnd - $rangeStart + 1));
        $response->headers->set('Content-Range', "bytes {$rangeStart}-{$safeRangeEnd}/{$fileSize}");
        $response->headers->set('Accept-Ranges', 'bytes');
        $response->headers->set('Cache-Control', 'private, max-age=60');

        return $response;
    }

    protected function parseRangeHeader(?string $rangeHeader, int $fileSize): ?array
    {
        if (! is_string($rangeHeader) || ! str_starts_with($rangeHeader, 'bytes=')) {
            return null;
        }

        $range = trim(substr($rangeHeader, 6));

        if ($range === '' || str_contains($range, ',')) {
            return null;
        }

        if (str_starts_with($range, '-')) {
            $length = (int) substr($range, 1);

            return [
                'start' => max(0, $fileSize - $length),
                'end' => $fileSize - 1,
            ];
        }

        if (! str_contains($range, '-')) {
            return null;
        }

        [$start, $end] = explode('-', $range, 2);
        $rangeStart = (int) $start;
        $rangeEnd = $end === '' ? $fileSize - 1 : (int) $end;

        if ($rangeStart > $rangeEnd) {
            return null;
        }

        return [
            'start' => $rangeStart,
            'end' => min($rangeEnd, $fileSize - 1),
        ];
    }
}
