<?php

namespace App\Services\Storage;

use App\Models\StorageObject;
use App\Models\StoragePolicy;
use App\Models\StorageUsageCounter;
use InvalidArgumentException;

class StorageQuotaService
{
    public function ensureUploadAllowed(int $incomingBytes): void
    {
        $policy = $this->activePolicy();
        $currentLiveBytes = $this->currentLiveBytes();

        if (($currentLiveBytes + $incomingBytes) > $policy->global_cap_bytes) {
            throw new InvalidArgumentException('The upload would exceed the global storage cap.');
        }
    }

    public function currentLiveBytes(): int
    {
        $counter = StorageUsageCounter::query()->first();

        if (! $counter) {
            return $this->recalculateUsage()->live_bytes;
        }

        return (int) $counter->live_bytes;
    }

    public function recalculateUsage(): StorageUsageCounter
    {
        $liveBytes = (int) StorageObject::query()
            ->whereNull('deleted_at')
            ->sum('size_bytes');

        $liveObjectCount = (int) StorageObject::query()
            ->whereNull('deleted_at')
            ->count();

        $counter = StorageUsageCounter::query()->first() ?? new StorageUsageCounter();

        $counter->forceFill([
            'live_object_count' => $liveObjectCount,
            'live_bytes' => $liveBytes,
            'updated_at' => now(),
        ])->save();

        return $counter;
    }

    public function activePolicy(): StoragePolicy
    {
        $policy = StoragePolicy::query()->first();

        if ($policy) {
            return $policy;
        }

        $policy = StoragePolicy::query()->create([
            'updated_at' => now(),
        ]);

        return $policy->fresh();
    }
}
