<?php

namespace App\Http\Traits;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

trait LazyLoadFileTrait
{
    /**
     * Stream file download with chunking for memory efficiency
     */
    protected function streamFileDownload(
        string $filePath,
        string $filename,
        string $mimeType = 'application/octet-stream',
        int $chunkSize = 8192
    ): StreamedResponse {
        $storage = Storage::disk('local');

        return response()->stream(function () use ($storage, $filePath, $chunkSize) {
            $stream = $storage->readStream($filePath);

            while (!feof($stream)) {
                echo fread($stream, $chunkSize);
                flush(); // Force flush to client
            }

            fclose($stream);
        }, 200, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Content-Length' => $storage->size($filePath),
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Stream partial file content (for range requests / resume downloads)
     */
    protected function streamPartialFileDownload(
        string $filePath,
        string $filename,
        string $mimeType,
        ?int $rangeStart = null,
        ?int $rangeEnd = null
    ): StreamedResponse|Response {
        $storage = Storage::disk('local');
        $fileSize = $storage->size($filePath);

        // Set default range if not provided
        if ($rangeStart === null) {
            $rangeStart = 0;
        }
        if ($rangeEnd === null) {
            $rangeEnd = $fileSize - 1;
        }

        // Validate range
        if ($rangeStart >= $fileSize || $rangeStart < 0) {
            return response('Invalid range', 416, ['Content-Range' => "bytes */{$fileSize}"]);
        }

        $rangeEnd = min($rangeEnd, $fileSize - 1);

        $stream = $storage->readStream($filePath);
        fseek($stream, $rangeStart);

        /** @var Response $response */
        $response = response()->stream(
            function () use ($stream, $rangeStart, $rangeEnd, $fileSize) {
                $chunkSize = 8192;
                $bytesRead = 0;
                $totalBytes = $rangeEnd - $rangeStart + 1;

                while ($bytesRead < $totalBytes && !feof($stream)) {
                    $remaining = $totalBytes - $bytesRead;
                    $toRead = min($chunkSize, $remaining);
                    echo fread($stream, $toRead);
                    $bytesRead += $toRead;
                    flush();
                }

                fclose($stream);
            },
            206 // Partial Content
        );

        $response
            ->header('Content-Type', $mimeType)
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"")
            ->header('Content-Length', (string)($rangeEnd - $rangeStart + 1))
            ->header('Content-Range', "bytes {$rangeStart}-{$rangeEnd}/{$fileSize}")
            ->header('Accept-Ranges', 'bytes')
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate');

        return $response;
    }

    /**
     * Stream video file with lazy loading
     */
    protected function streamVideoDownload(
        string $filePath,
        string $filename,
        ?int $rangeStart = null,
        ?int $rangeEnd = null
    ): StreamedResponse|Response {
        return $this->streamPartialFileDownload(
            $filePath,
            $filename,
            'video/mp4',
            $rangeStart,
            $rangeEnd
        );
    }

    /**
     * Stream audio file
     */
    protected function streamAudioDownload(
        string $filePath,
        string $filename,
        ?int $rangeStart = null,
        ?int $rangeEnd = null
    ): StreamedResponse|Response {
        return $this->streamPartialFileDownload(
            $filePath,
            $filename,
            'audio/mpeg',
            $rangeStart,
            $rangeEnd
        );
    }

    /**
     * Stream document download
     */
    protected function streamDocumentDownload(
        string $filePath,
        string $filename,
        string $mimeType = 'application/pdf'
    ): StreamedResponse {
        return $this->streamFileDownload($filePath, $filename, $mimeType);
    }

    /**
     * Parse HTTP Range header
     */
    protected function parseRangeHeader(?string $rangeHeader, int $fileSize): ?array
    {
        if (empty($rangeHeader) || !str_starts_with($rangeHeader, 'bytes=')) {
            return null;
        }

        $ranges = substr($rangeHeader, 6);
        $parts = explode(',', $ranges);

        if (count($parts) > 1) {
            // Multi-range requests not typically supported
            return null;
        }

        $range = trim($parts[0]);

        if (str_starts_with($range, '-')) {
            // Suffix range (e.g., -500 for last 500 bytes)
            $length = intval(substr($range, 1));
            return [
                'start' => max(0, $fileSize - $length),
                'end' => $fileSize - 1,
            ];
        }

        if (strpos($range, '-') !== false) {
            [$start, $end] = explode('-', $range, 2);
            $start = intval($start);
            $end = $end === '' ? $fileSize - 1 : intval($end);

            if ($start <= $end) {
                return [
                    'start' => $start,
                    'end' => min($end, $fileSize - 1),
                ];
            }
        }

        return null;
    }
}
