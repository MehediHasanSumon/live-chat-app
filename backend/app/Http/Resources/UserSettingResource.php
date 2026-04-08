<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserSettingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'theme' => $this->theme,
            'show_active_status' => $this->show_active_status,
            'allow_message_requests' => $this->allow_message_requests,
            'push_enabled' => $this->push_enabled,
            'sound_enabled' => $this->sound_enabled,
            'vibrate_enabled' => $this->vibrate_enabled,
            'quiet_hours_enabled' => $this->quiet_hours_enabled,
            'quiet_hours_start' => $this->quiet_hours_start,
            'quiet_hours_end' => $this->quiet_hours_end,
            'quiet_hours_timezone' => $this->quiet_hours_timezone,
        ];
    }
}
