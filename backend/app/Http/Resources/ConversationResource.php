<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $membership = $this->relationLoaded('members')
            ? $this->members->first()
            : null;

        return [
            'id' => $this->id,
            'type' => $this->type,
            'direct_key' => $this->direct_key,
            'title' => $this->title,
            'description' => $this->description,
            'avatar_object_id' => $this->avatar_object_id,
            'created_by' => $this->created_by,
            'settings_json' => $this->settings_json,
            'last_message_seq' => $this->last_message_seq,
            'last_message_id' => $this->last_message_id,
            'last_message_preview' => $this->last_message_preview,
            'last_message_at' => $this->last_message_at,
            'active_room_uuid' => $this->active_room_uuid,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'creator' => $this->whenLoaded('creator', fn () => (new UserResource($this->creator))->resolve($request)),
            'membership' => $membership ? (new ConversationMemberResource($membership))->resolve($request) : null,
            'members' => $this->whenLoaded('members', fn () => ConversationMemberResource::collection($this->members)->resolve()),
        ];
    }
}
