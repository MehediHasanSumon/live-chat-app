<?php

namespace App\Services\Storage;

use App\Jobs\ExtractStorageObjectMetadataJob;
use App\Jobs\ScanStorageObjectForVirusesJob;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\StorageObject;
use App\Services\Conversations\ConversationMemberService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

class StorageObjectService
{
    public function __construct(
        protected StorageQuotaService $storageQuotaService,
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    public function storeUpload(UploadedFile $file, int $userId, string $purpose = 'message_attachment'): StorageObject
    {
        $this->storageQuotaService->ensureUploadAllowed((int) $file->getSize());

        $detectedMimeType = $this->detectMimeType($file);
        $this->validateMimeType($detectedMimeType, $file);

        $mediaKind = $this->resolveMediaKind($detectedMimeType);
        $objectUuid = (string) Str::uuid();
        $diskPath = $file->storeAs(
            sprintf('uploads/%s/%s', now()->format('Y/m'), $userId),
            sprintf('%s.%s', $objectUuid, $file->getClientOriginalExtension() ?: $file->extension() ?: 'bin'),
            ['disk' => config('uploads.disk')],
        );

        $storageObject = StorageObject::query()->create([
            'object_uuid' => $objectUuid,
            'owner_user_id' => $userId,
            'purpose' => $purpose,
            'media_kind' => $mediaKind,
            'storage_driver' => 'local',
            'disk_path' => $diskPath,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $detectedMimeType,
            'file_ext' => $file->getClientOriginalExtension() ?: $file->extension(),
            'size_bytes' => (int) $file->getSize(),
            'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
            'virus_scan_status' => config('uploads.clamav.enabled') ? 'pending' : 'clean',
            'transcode_status' => $this->shouldExtractMetadata($mediaKind) ? 'pending' : 'ready',
            'delete_eligible_at' => $this->resolveDeleteEligibility((int) $file->getSize()),
        ]);

        $this->storageQuotaService->recalculateUsage();

        if ($this->shouldExtractMetadata($mediaKind)) {
            ExtractStorageObjectMetadataJob::dispatch($storageObject->id);
        }

        if (config('uploads.clamav.enabled')) {
            ScanStorageObjectForVirusesJob::dispatch($storageObject->id);
        }

        return $storageObject->fresh();
    }

    public function attachToMessage(StorageObject $storageObject, Message $message, int $actorId, int $displayOrder = 1): MessageAttachment
    {
        if ($storageObject->deleted_at) {
            throw new InvalidArgumentException('This file is no longer available.');
        }

        if ($storageObject->purpose !== 'message_attachment') {
            throw new InvalidArgumentException('Only message attachments can be linked to a message.');
        }

        if ((int) $storageObject->owner_user_id !== $actorId) {
            throw new InvalidArgumentException('You may only attach files that you uploaded.');
        }

        if ((int) $message->sender_id !== $actorId) {
            throw new InvalidArgumentException('You may only attach uploads to your own messages.');
        }

        $this->conversationMemberService->requireActiveMembership($message->conversation, $actorId);

        $attachment = MessageAttachment::query()->firstOrCreate([
            'message_id' => $message->getKey(),
            'storage_object_id' => $storageObject->getKey(),
        ], [
            'conversation_id' => $message->conversation_id,
            'uploader_user_id' => $actorId,
            'display_order' => $displayOrder,
            'created_at' => now(),
        ]);

        if ($attachment->wasRecentlyCreated) {
            $storageObject->forceFill([
                'ref_count' => (int) $storageObject->ref_count + 1,
                'first_attached_at' => $storageObject->first_attached_at ?? now(),
                'last_attached_at' => now(),
            ])->save();
        } else {
            $attachment->forceFill([
                'display_order' => $displayOrder,
            ])->save();

            $storageObject->forceFill([
                'last_attached_at' => now(),
            ])->save();
        }

        return $attachment->fresh(['storageObject']);
    }

    public function findAccessibleObjectByUuid(string $objectUuid): StorageObject
    {
        return StorageObject::query()
            ->where('object_uuid', $objectUuid)
            ->whereNull('deleted_at')
            ->firstOrFail();
    }

    public function canDownloadObject(StorageObject $storageObject): bool
    {
        return Storage::disk(config('uploads.disk'))->exists($storageObject->disk_path);
    }

    protected function shouldExtractMetadata(string $mediaKind): bool
    {
        return in_array($mediaKind, ['image', 'video', 'audio', 'voice', 'gif'], true);
    }

    protected function detectMimeType(UploadedFile $file): string
    {
        $realPath = $file->getRealPath();

        if (! $realPath) {
            throw new InvalidArgumentException('The uploaded file could not be processed.');
        }

        $detectedMimeType = (string) finfo_file(finfo_open(FILEINFO_MIME_TYPE), $realPath);

        if ($detectedMimeType === '') {
            throw new InvalidArgumentException('The uploaded file mime type could not be detected.');
        }

        return $detectedMimeType;
    }

    protected function validateMimeType(string $detectedMimeType, UploadedFile $file): void
    {
        if (! in_array($detectedMimeType, config('uploads.allowed_mime_types'), true)) {
            throw new InvalidArgumentException('This file type is not allowed.');
        }

        $clientMimeType = $file->getClientMimeType();

        if ($clientMimeType && ! in_array($clientMimeType, config('uploads.allowed_mime_types'), true)) {
            throw new InvalidArgumentException('The uploaded file reported an unsupported mime type.');
        }

        if (str_starts_with($detectedMimeType, 'image/') && @getimagesize($file->getRealPath()) === false) {
            throw new InvalidArgumentException('The uploaded image file appears to be invalid.');
        }
    }

    protected function resolveMediaKind(string $mimeType): string
    {
        if ($mimeType === 'image/gif') {
            return 'gif';
        }

        if (str_starts_with($mimeType, 'image/')) {
            return 'image';
        }

        if (str_starts_with($mimeType, 'video/')) {
            return 'video';
        }

        if (str_starts_with($mimeType, 'audio/')) {
            return 'audio';
        }

        return 'file';
    }

    protected function resolveDeleteEligibility(int $sizeBytes): ?\Illuminate\Support\Carbon
    {
        $policy = $this->storageQuotaService->activePolicy();

        if (! $policy->auto_cleanup_enabled) {
            return null;
        }

        if ($sizeBytes > (int) $policy->large_file_threshold_bytes && $policy->large_file_rule_enabled) {
            return now()->addDays((int) $policy->large_file_delete_after_days);
        }

        if ($sizeBytes <= (int) $policy->small_file_threshold_bytes && $policy->small_file_rule_enabled) {
            return now()->addDays((int) $policy->small_file_delete_after_days);
        }

        return null;
    }
}
