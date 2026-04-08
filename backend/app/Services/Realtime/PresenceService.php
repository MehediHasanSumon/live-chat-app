<?php

namespace App\Services\Realtime;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

class PresenceService
{
    public const HEARTBEAT_TTL_SECONDS = 70;

    /**
     * @return array<string, mixed>
     */
    public function heartbeat(int $userId, string $deviceUuid): array
    {
        $cacheKey = $this->cacheKey($userId);
        $expiresAt = now()->addSeconds(self::HEARTBEAT_TTL_SECONDS);

        Cache::put($cacheKey, [
            'user_id' => $userId,
            'device_uuid' => $deviceUuid,
            'updated_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
        ], $expiresAt);

        User::query()
            ->whereKey($userId)
            ->update([
                'last_seen_at' => now(),
            ]);

        return [
            'presence_key' => $cacheKey,
            'ttl_seconds' => self::HEARTBEAT_TTL_SECONDS,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }

    public function cacheKey(int $userId): string
    {
        return "presence:user:{$userId}";
    }
}
