<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageAttachmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'message_id' => $this->message_id,
            'conversation_id' => $this->conversation_id,
            'storage_object_id' => $this->storage_object_id,
            'uploader_user_id' => $this->uploader_user_id,
            'display_order' => $this->display_order,
            'created_at' => $this->created_at,
            'storage_object' => $this->whenLoaded('storageObject', fn () => (new StorageObjectResource($this->storageObject))->resolve($request)),
        ];
    }
}
