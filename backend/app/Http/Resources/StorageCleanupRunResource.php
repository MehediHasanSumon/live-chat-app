<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StorageCleanupRunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rule_key' => $this->rule_key,
            'dry_run' => $this->dry_run,
            'status' => $this->status,
            'objects_scanned' => $this->objects_scanned,
            'objects_deleted' => $this->objects_deleted,
            'bytes_freed' => $this->bytes_freed,
            'initiated_by' => $this->initiated_by,
            'started_at' => $this->started_at,
            'finished_at' => $this->finished_at,
            'notes' => $this->notes,
        ];
    }
}
