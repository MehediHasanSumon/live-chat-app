<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'phone' => $this->phone,
            'status' => $this->status,
            'last_seen_at' => $this->last_seen_at,
            'avatar_object_id' => $this->avatar_object_id,
            'avatar_object' => $this->whenLoaded('avatarObject', fn () => (new StorageObjectResource($this->avatarObject))->resolve($request)),
            'roles' => method_exists($this->resource, 'getRoleNames')
                ? $this->resource->getRoleNames()->values()->all()
                : [],
            'permissions' => method_exists($this->resource, 'getAllPermissions')
                ? $this->resource->getAllPermissions()->pluck('name')->values()->all()
                : [],
        ];
    }
}
