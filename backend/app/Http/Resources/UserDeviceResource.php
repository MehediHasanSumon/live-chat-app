<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserDeviceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'device_uuid' => $this->device_uuid,
            'platform' => $this->platform,
            'device_name' => $this->device_name,
            'push_provider' => $this->push_provider,
            'push_token' => $this->push_token,
            'app_version' => $this->app_version,
            'build_number' => $this->build_number,
            'locale' => $this->locale,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            'last_seen_at' => $this->last_seen_at,
        ];
    }
}
