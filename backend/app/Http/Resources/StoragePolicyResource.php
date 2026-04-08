<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoragePolicyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'global_cap_bytes' => $this->global_cap_bytes,
            'auto_cleanup_enabled' => $this->auto_cleanup_enabled,
            'large_file_threshold_bytes' => $this->large_file_threshold_bytes,
            'large_file_rule_enabled' => $this->large_file_rule_enabled,
            'large_file_delete_after_days' => $this->large_file_delete_after_days,
            'small_file_threshold_bytes' => $this->small_file_threshold_bytes,
            'small_file_rule_enabled' => $this->small_file_rule_enabled,
            'small_file_delete_after_days' => $this->small_file_delete_after_days,
            'cleanup_behavior' => $this->cleanup_behavior,
            'updated_by' => $this->updated_by,
            'updated_at' => $this->updated_at,
        ];
    }
}
