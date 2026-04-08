<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserRestrictionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'owner_user_id' => $this->owner_user_id,
            'target_user_id' => $this->target_user_id,
            'move_to_requests' => $this->move_to_requests,
            'mute_notifications' => $this->mute_notifications,
            'prevent_calling' => $this->prevent_calling,
            'created_at' => $this->created_at,
        ];
    }
}
