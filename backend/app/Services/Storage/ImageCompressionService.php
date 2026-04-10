<?php

namespace App\Services\Storage;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;

class ImageCompressionService
{
    protected ?ImageManager $imageManager = null;

    public function __construct()
    {
        try {
            $this->imageManager = new ImageManager(GdDriver::class);
        } catch (\Exception $e) {
            Log::warning('ImageCompressionService: Failed to initialize ImageManager', [
                'error' => $e->getMessage(),
            ]);
            $this->imageManager = null;
        }
    }

    /**
     * Compress an image file
     */
    public function compress(
        string $sourcePath,
        string $destinationPath,
        int $quality = 80,
        ?int $maxWidth = null,
        ?int $maxHeight = null
    ): array {
        if (!$this->imageManager) {
            return $this->fallbackCompress($sourcePath, $destinationPath, $quality);
        }

        try {
            $disk = $this->localDisk();
            $filePath = $disk->path($sourcePath);
            $image = $this->readImage($filePath);

            // Resize if dimensions exceed limits
            if ($maxWidth && $maxHeight) {
                $image = $image->scale(width: $maxWidth, height: $maxHeight);
            }

            // Encode and save with compression
            $encoded = $image->encode(new JpegEncoder(quality: $quality));
            $disk->put($destinationPath, (string) $encoded);
            $originalSize = $disk->size($sourcePath);
            $compressedSize = $disk->size($destinationPath);

            return [
                'success' => true,
                'path' => $destinationPath,
                'original_size' => $originalSize,
                'compressed_size' => $compressedSize,
                'compression_ratio' => $this->calculateCompressionRatio(
                    $originalSize,
                    $compressedSize
                ),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Fallback compression using GD functions directly
     */
    protected function fallbackCompress(
        string $sourcePath,
        string $destinationPath,
        int $quality = 80
    ): array {
        try {
            $disk = $this->localDisk();
            $sourceAbsolutePath = $disk->path($sourcePath);
            $destinationAbsolutePath = $disk->path($destinationPath);
            $sourceContents = file_get_contents($sourceAbsolutePath);

            if ($sourceContents === false) {
                return ['success' => false, 'error' => 'Unable to read source image'];
            }

            $image = imagecreatefromstring($sourceContents);
            if (!$image) {
                return ['success' => false, 'error' => 'Unable to create image from source'];
            }

            if (!imagejpeg($image, $destinationAbsolutePath, $quality)) {
                return ['success' => false, 'error' => 'Unable to write compressed image'];
            }
            $originalSize = $this->getFileSize($sourceAbsolutePath);
            $compressedSize = $this->getFileSize($destinationAbsolutePath);

            return [
                'success' => true,
                'path' => $destinationPath,
                'original_size' => $originalSize,
                'compressed_size' => $compressedSize,
                'compression_ratio' => $this->calculateCompressionRatio(
                    $originalSize,
                    $compressedSize
                ),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate thumbnail with automatic sizing
     */
    public function generateThumbnail(
        string $sourcePath,
        string $destinationPath,
        int $width = 200,
        int $height = 200,
        string $fit = 'crop' // 'crop', 'contain', 'fill'
    ): array {
        if (!$this->imageManager) {
            return ['success' => false, 'error' => 'Image processing not available'];
        }

        try {
            $disk = $this->localDisk();
            $filePath = $disk->path($sourcePath);
            $image = $this->readImage($filePath);

            // Handle different fit options
            $image = match ($fit) {
                'crop' => $image->cover(width: $width, height: $height),
                'contain' => $image->scale(width: $width, height: $height),
                'fill' => $image->scale(width: $width, height: $height),
                default => $image->cover(width: $width, height: $height),
            };

            // Save thumbnail with compression
            $encoded = $image->encode(new JpegEncoder(quality: 75));
            $disk->put($destinationPath, (string) $encoded);

            return [
                'success' => true,
                'path' => $destinationPath,
                'width' => $width,
                'height' => $height,
                'size' => $disk->size($destinationPath),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate multiple thumbnail sizes
     */
    public function generateThumbnailSizes(
        string $sourcePath,
        string $baseDestinationPath,
        array $sizes = ['small' => 100, 'medium' => 300, 'large' => 600]
    ): array {
        $results = [];

        foreach ($sizes as $name => $dimension) {
            $destPath = str_replace('{size}', $name, $baseDestinationPath);
            $result = $this->generateThumbnail(
                $sourcePath,
                $destPath,
                width: $dimension,
                height: $dimension,
                fit: 'crop'
            );
            $results[$name] = $result;
        }

        return $results;
    }

    /**
     * Convert image to WebP format
     */
    public function convertToWebP(
        string $sourcePath,
        string $destinationPath,
        int $quality = 80
    ): array {
        if (!$this->imageManager) {
            return ['success' => false, 'error' => 'Image processing not available'];
        }

        try {
            $disk = $this->localDisk();
            $filePath = $disk->path($sourcePath);
            $image = $this->readImage($filePath);
            $encoded = $image->encode(new WebpEncoder(quality: $quality));
            $disk->put($destinationPath, (string) $encoded);

            return [
                'success' => true,
                'path' => $destinationPath,
                'format' => 'WebP',
                'size' => $disk->size($destinationPath),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get image dimensions
     */
    public function getImageDimensions(string $sourcePath): array
    {
        if (!$this->imageManager) {
            return ['width' => 0, 'height' => 0, 'aspect_ratio' => 0.0];
        }

        try {
            $filePath = $this->localDisk()->path($sourcePath);
            $image = $this->readImage($filePath);
            $height = $image->height();

            return [
                'width' => $image->width(),
                'height' => $height,
                'aspect_ratio' => $height === 0 ? 0.0 : $image->width() / $height,
            ];
        } catch (\Exception $e) {
            return [
                'width' => 0,
                'height' => 0,
                'aspect_ratio' => 0.0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Optimize image for web
     */
    public function optimizeForWeb(
        string $sourcePath,
        string $destinationPath,
        int $maxWidth = 1920,
        int $quality = 75
    ): array {
        if (!$this->imageManager) {
            return $this->fallbackCompress($sourcePath, $destinationPath, $quality);
        }

        try {
            $disk = $this->localDisk();
            $filePath = $disk->path($sourcePath);
            $image = $this->readImage($filePath);

            // Scale down if exceeds max width
            if ($image->width() > $maxWidth) {
                $image = $image->scale(width: $maxWidth);
            }

            // Save optimized version
            $encoded = $image->encode(new JpegEncoder(quality: $quality));
            $disk->put($destinationPath, (string) $encoded);
            $originalSize = $disk->size($sourcePath);
            $optimizedSize = $disk->size($destinationPath);

            return [
                'success' => true,
                'path' => $destinationPath,
                'original_size' => $originalSize,
                'optimized_size' => $optimizedSize,
                'compression_ratio' => $this->calculateCompressionRatio(
                    $originalSize,
                    $optimizedSize
                ),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Batch process images
     */
    public function batchCompress(array $filePaths, int $quality = 80): array
    {
        $results = [];

        foreach ($filePaths as $sourcePath) {
            $filename = basename($sourcePath);
            $destinationPath = 'compressed/' . $filename;

            $results[$sourcePath] = $this->compress(
                $sourcePath,
                $destinationPath,
                $quality
            );
        }

        return $results;
    }

    /**
     * Calculate compression ratio
     */
    protected function calculateCompressionRatio(int $originalSize, int $compressedSize): float
    {
        if ($originalSize === 0) {
            return 0;
        }

        return round(((1 - ($compressedSize / $originalSize)) * 100), 2);
    }

    protected function localDisk(): Filesystem
    {
        return Storage::disk('local');
    }

    protected function readImage(string $filePath): ImageInterface
    {
        if (!$this->imageManager) {
            throw new \RuntimeException('Image processing not available');
        }

        return $this->imageManager->decodePath($filePath);
    }

    protected function getFileSize(string $path): int
    {
        $size = filesize($path);

        return $size === false ? 0 : $size;
    }
}
