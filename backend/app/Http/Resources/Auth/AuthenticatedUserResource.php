<?php

namespace App\Http\Resources\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthenticatedUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(['settings', 'avatarObject']);

        return [
            'user' => [
                'id' => $this->id,
                'username' => $this->username,
                'name' => $this->name,
                'email' => $this->email,
                'phone' => $this->phone,
                'status' => $this->status,
                'last_seen_at' => $this->last_seen_at,
                'avatar_object_id' => $this->avatar_object_id,
            ],
            'settings' => $this->settings ? [
                'theme' => $this->settings->theme,
                'show_active_status' => $this->settings->show_active_status,
                'allow_message_requests' => $this->settings->allow_message_requests,
                'push_enabled' => $this->settings->push_enabled,
                'sound_enabled' => $this->settings->sound_enabled,
                'vibrate_enabled' => $this->settings->vibrate_enabled,
                'quiet_hours_enabled' => $this->settings->quiet_hours_enabled,
                'quiet_hours_start' => $this->settings->quiet_hours_start,
                'quiet_hours_end' => $this->settings->quiet_hours_end,
                'quiet_hours_timezone' => $this->settings->quiet_hours_timezone,
            ] : null,
        ];
    }
}
