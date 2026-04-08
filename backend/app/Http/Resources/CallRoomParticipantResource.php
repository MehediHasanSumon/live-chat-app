<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CallRoomParticipantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'call_room_id' => $this->call_room_id,
            'user_id' => $this->user_id,
            'invite_status' => $this->invite_status,
            'joined_at' => $this->joined_at,
            'left_at' => $this->left_at,
            'left_reason' => $this->left_reason,
            'is_video_publisher' => $this->is_video_publisher,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'user' => $this->whenLoaded('user', fn () => (new UserResource($this->user))->resolve($request)),
        ];
    }
}
