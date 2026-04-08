<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationMemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'role' => $this->role,
            'membership_state' => $this->membership_state,
            'last_read_seq' => $this->last_read_seq,
            'last_delivered_seq' => $this->last_delivered_seq,
            'unread_count_cache' => $this->unread_count_cache,
            'archived_at' => $this->archived_at,
            'pinned_at' => $this->pinned_at,
            'muted_until' => $this->muted_until,
            'notifications_mode' => $this->notifications_mode,
            'notification_schedule_json' => $this->notification_schedule_json,
            'joined_at' => $this->joined_at,
            'user' => $this->whenLoaded('user', fn () => (new UserResource($this->user))->resolve($request)),
        ];
    }
}
