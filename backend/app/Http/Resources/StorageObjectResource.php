<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

class StorageObjectResource extends JsonResource
{
    protected function buildDownloadUrl(): ?string
    {
        if ($this->deleted_at) {
            return null;
        }

        $ttlMinutes = max((int) config('uploads.signed_download_ttl_minutes'), 1);
        $expiresAt = now()->addMinutes($ttlMinutes)->startOfMinute();

        return URL::temporarySignedRoute(
            'files.download',
            $expiresAt,
            ['objectUuid' => $this->object_uuid],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'object_uuid' => $this->object_uuid,
            'owner_user_id' => $this->owner_user_id,
            'purpose' => $this->purpose,
            'media_kind' => $this->media_kind,
            'storage_driver' => $this->storage_driver,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'file_ext' => $this->file_ext,
            'size_bytes' => $this->size_bytes,
            'checksum_sha256' => $this->checksum_sha256,
            'width' => $this->width,
            'height' => $this->height,
            'duration_ms' => $this->duration_ms,
            'waveform_json' => $this->waveform_json,
            'thumbnail_path' => $this->thumbnail_path,
            'preview_blurhash' => $this->preview_blurhash,
            'virus_scan_status' => $this->virus_scan_status,
            'transcode_status' => $this->transcode_status,
            'ref_count' => $this->ref_count,
            'first_attached_at' => $this->first_attached_at,
            'last_attached_at' => $this->last_attached_at,
            'retention_mode' => $this->retention_mode,
            'delete_eligible_at' => $this->delete_eligible_at,
            'deleted_at' => $this->deleted_at,
            'deleted_reason' => $this->deleted_reason,
            'is_expired' => $this->deleted_at !== null,
            'placeholder_text' => $this->deleted_at ? 'File expired / removed by storage policy' : null,
            'display_name' => $this->deleted_at ? 'File expired / removed by storage policy' : $this->original_name,
            'download_url' => $this->buildDownloadUrl(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
