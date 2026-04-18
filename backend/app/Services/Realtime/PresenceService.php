<?php

namespace App\Services\Realtime;

use App\Models\ConversationMember;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class PresenceService
{
    public const HEARTBEAT_TTL_SECONDS = 70;

    public function __construct(
        protected UserRealtimeSignalService $userRealtimeSignalService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function heartbeat(int $userId, string $deviceUuid): array
    {
        $cacheKey = $this->cacheKey($userId);
        $now = now();
        $expiresAt = $now->copy()->addSeconds(self::HEARTBEAT_TTL_SECONDS);
        $wasOnline = $this->activePresence($userId) !== null;
        $devices = $this->activeDevices($userId, $now);

        $devices[$deviceUuid] = [
            'device_uuid' => $deviceUuid,
            'updated_at' => $now->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
        ];

        $payload = $this->storeActiveDevices($cacheKey, $userId, $devices, $now);

        User::query()
            ->whereKey($userId)
            ->update([
                'last_seen_at' => $now,
            ]);

        $this->broadcastPresenceUpdate(
            $userId,
            true,
            $now->toIso8601String(),
            ! $wasOnline,
        );

        return [
            'presence_key' => $cacheKey,
            'ttl_seconds' => self::HEARTBEAT_TTL_SECONDS,
            'expires_at' => $payload['expires_at'],
            'active_devices' => count($payload['devices']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function offline(int $userId, string $deviceUuid): array
    {
        $cacheKey = $this->cacheKey($userId);
        $now = now();
        $wasOnline = $this->activePresence($userId) !== null;
        $devices = $this->activeDevices($userId, $now);
        $disconnected = array_key_exists($deviceUuid, $devices);

        unset($devices[$deviceUuid]);

        $payload = $this->storeActiveDevices($cacheKey, $userId, $devices, $now);

        if ($wasOnline || $disconnected) {
            $this->broadcastPresenceUpdate(
                $userId,
                $payload !== null,
                $now->toIso8601String(),
                $wasOnline !== ($payload !== null),
            );
        }

        return [
            'presence_key' => $cacheKey,
            'disconnected' => $disconnected,
            'is_online' => $payload !== null,
            'active_devices' => count($payload['devices'] ?? []),
            'expires_at' => $payload['expires_at'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function activePresence(int $userId): ?array
    {
        $cacheKey = $this->cacheKey($userId);
        $now = now();
        $devices = $this->activeDevices($userId, $now);

        return $this->storeActiveDevices($cacheKey, $userId, $devices, $now);
    }

    public function cacheKey(int $userId): string
    {
        return "presence:user:{$userId}";
    }

    /**
     * @return array<string, array<string, string>>
     */
    protected function activeDevices(int $userId, Carbon $now): array
    {
        $payload = Cache::get($this->cacheKey($userId));

        if (! is_array($payload)) {
            return [];
        }

        $devices = $payload['devices'] ?? null;

        if (! is_array($devices)) {
            return [];
        }

        return collect($devices)
            ->filter(function ($device) use ($now): bool {
                if (! is_array($device) || ! isset($device['expires_at'], $device['device_uuid'])) {
                    return false;
                }

                try {
                    return Carbon::parse($device['expires_at'])->greaterThan($now);
                } catch (\Throwable) {
                    return false;
                }
            })
            ->mapWithKeys(fn (array $device): array => [
                $device['device_uuid'] => $device,
            ])
            ->all();
    }

    /**
     * @param  array<string, array<string, string>>  $devices
     * @return array<string, mixed>|null
     */
    protected function storeActiveDevices(string $cacheKey, int $userId, array $devices, Carbon $now): ?array
    {
        if ($devices === []) {
            Cache::forget($cacheKey);

            return null;
        }

        $expiresAt = collect($devices)
            ->pluck('expires_at')
            ->map(fn (string $value) => Carbon::parse($value))
            ->sortBy(fn (Carbon $value): int => $value->getTimestamp())
            ->last();

        $payload = [
            'user_id' => $userId,
            'updated_at' => $now->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
            'devices' => $devices,
        ];

        Cache::put($cacheKey, $payload, $expiresAt);

        return $payload;
    }

    protected function broadcastPresenceUpdate(
        int $userId,
        bool $isOnline,
        string $lastSeenAt,
        bool $statusChanged,
    ): void {
        $recipientIds = ConversationMember::query()
            ->select('conversation_members.user_id')
            ->join('conversations', 'conversations.id', '=', 'conversation_members.conversation_id')
            ->where('conversations.type', 'direct')
            ->where('conversation_members.membership_state', 'active')
            ->whereIn('conversation_members.conversation_id', function ($query) use ($userId): void {
                $query
                    ->select('conversation_id')
                    ->from('conversation_members')
                    ->where('user_id', $userId)
                    ->where('membership_state', 'active');
            })
            ->where('conversation_members.user_id', '!=', $userId)
            ->distinct()
            ->pluck('conversation_members.user_id');

        foreach ($recipientIds as $recipientId) {
            $this->userRealtimeSignalService->dispatchPresence((int) $recipientId, [
                'user_id' => $userId,
                'is_online' => $isOnline,
                'last_seen_at' => $lastSeenAt,
                'status_changed' => $statusChanged,
            ]);
        }
    }
}
