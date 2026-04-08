<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserBlockResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'blocker_user_id' => $this->blocker_user_id,
            'blocked_user_id' => $this->blocked_user_id,
            'block_chat' => $this->block_chat,
            'block_call' => $this->block_call,
            'hide_presence' => $this->hide_presence,
            'created_at' => $this->created_at,
        ];
    }
}
