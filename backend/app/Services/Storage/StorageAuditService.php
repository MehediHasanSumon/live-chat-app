<?php

namespace App\Services\Storage;

use App\Models\AuditLog;

class StorageAuditService
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function log(?int $actorUserId, string $entityType, ?int $entityId, string $action, ?array $before = null, ?array $after = null): AuditLog
    {
        return AuditLog::query()->create([
            'actor_user_id' => $actorUserId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'before_json' => $before,
            'after_json' => $after,
            'created_at' => now(),
        ]);
    }
}
