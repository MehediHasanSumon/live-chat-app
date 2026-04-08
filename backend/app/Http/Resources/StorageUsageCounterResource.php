<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StorageUsageCounterResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'live_object_count' => $this->live_object_count,
            'live_bytes' => $this->live_bytes,
            'deleted_bytes_total' => $this->deleted_bytes_total,
            'updated_at' => $this->updated_at,
        ];
    }
}
