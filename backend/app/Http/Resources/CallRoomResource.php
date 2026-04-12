<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CallRoomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'room_uuid' => $this->room_uuid,
            'conversation_id' => $this->conversation_id,
            'scope' => $this->scope,
            'media_type' => $this->media_type,
            'created_by' => $this->created_by,
            'status' => $this->status,
            'max_participants' => $this->max_participants,
            'max_video_publishers' => $this->max_video_publishers,
            'started_at' => $this->started_at,
            'ended_at' => $this->ended_at,
            'ended_reason' => $this->ended_reason,
            'duration_seconds' => $this->duration_seconds,
            'last_webhook_at' => $this->last_webhook_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'participants' => $this->whenLoaded('participants', fn () => CallRoomParticipantResource::collection($this->participants)->resolve()),
        ];
    }
}
