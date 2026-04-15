<?php

namespace App\Services\Storage;

use App\Models\StorageCleanupRun;
use App\Models\StorageObject;
use App\Models\StoragePolicy;
use App\Models\StorageUsageCounter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

class StorageCleanupService
{
    public function __construct(
        protected StorageQuotaService $storageQuotaService,
        protected StorageAuditService $storageAuditService,
    ) {
    }

    public function policy(): StoragePolicy
    {
        return $this->storageQuotaService->activePolicy();
    }

    public function usage(): StorageUsageCounter
    {
        return $this->storageQuotaService->recalculateUsage();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updatePolicy(array $payload, int $actorId): StoragePolicy
    {
        $policy = $this->policy();
        $before = $policy->toArray();

        $policy->fill($payload);
        $policy->forceFill([
            'updated_by' => $actorId,
            'updated_at' => now(),
        ])->save();

        $policy = $policy->fresh();
        $recalculatedObjects = $this->recalculateDefaultObjectEligibility($policy);

        $this->storageAuditService->log(
            $actorId,
            'storage_policy',
            $policy->id,
            'policy_updated',
            $before,
            array_merge($policy->toArray(), [
                'recalculated_storage_objects' => $recalculatedObjects,
            ]),
        );

        return $policy;
    }

    /**
     * @return array{rule_key:string, objects_scanned:int, bytes_freed:int, objects: Collection<int, StorageObject>}
     */
    public function preview(string $ruleKey, int $limit = 25): array
    {
        $candidates = $this->candidates($ruleKey)
            ->orderBy('delete_eligible_at')
            ->limit($limit)
            ->get();

        return [
            'rule_key' => $ruleKey,
            'objects_scanned' => (int) $this->candidates($ruleKey)->count(),
            'bytes_freed' => (int) $this->candidates($ruleKey)->sum('size_bytes'),
            'objects' => $candidates,
        ];
    }

    public function run(string $ruleKey, ?int $actorId = null, bool $dryRun = false): StorageCleanupRun
    {
        $run = StorageCleanupRun::query()->create([
            'rule_key' => $ruleKey,
            'dry_run' => $dryRun,
            'status' => 'running',
            'initiated_by' => $actorId,
            'started_at' => now(),
        ]);

        $candidates = $this->candidates($ruleKey)->get();
        $bytesFreed = 0;
        $deletedCount = 0;

        foreach ($candidates as $storageObject) {
            if ($dryRun) {
                $bytesFreed += (int) $storageObject->size_bytes;
                continue;
            }

            if ($this->deleteBinaryKeepMessage($storageObject, $ruleKey, $actorId)) {
                $deletedCount++;
                $bytesFreed += (int) $storageObject->size_bytes;
            }
        }

        $run->forceFill([
            'status' => 'completed',
            'objects_scanned' => $candidates->count(),
            'objects_deleted' => $dryRun ? 0 : $deletedCount,
            'bytes_freed' => $bytesFreed,
            'finished_at' => now(),
            'notes' => $dryRun ? 'Dry run preview only.' : null,
        ])->save();

        $this->storageAuditService->log(
            $actorId,
            'storage_cleanup_run',
            $run->id,
            $dryRun ? 'cleanup_previewed' : 'cleanup_executed',
            null,
            $run->toArray(),
        );

        $this->storageQuotaService->recalculateUsage();

        return $run->fresh();
    }

    public function exemptObject(StorageObject $storageObject, int $actorId): StorageObject
    {
        $before = $storageObject->toArray();

        $storageObject->forceFill([
            'retention_mode' => 'exempt',
            'delete_eligible_at' => null,
        ])->save();

        $this->storageAuditService->log(
            $actorId,
            'storage_object',
            $storageObject->id,
            'exempted',
            $before,
            $storageObject->fresh()->toArray(),
        );

        return $storageObject->fresh();
    }

    public function removeExemption(StorageObject $storageObject, int $actorId): StorageObject
    {
        $before = $storageObject->toArray();
        $policy = $this->policy();

        $storageObject->forceFill([
            'retention_mode' => 'default',
            'delete_eligible_at' => $this->recalculateDeleteEligibility((int) $storageObject->size_bytes, $policy),
        ])->save();

        $this->storageAuditService->log(
            $actorId,
            'storage_object',
            $storageObject->id,
            'exemption_removed',
            $before,
            $storageObject->fresh()->toArray(),
        );

        return $storageObject->fresh();
    }

    protected function candidates(string $ruleKey)
    {
        $policy = $this->policy();

        if (! $policy->auto_cleanup_enabled) {
            return StorageObject::query()->whereRaw('1 = 0');
        }

        $query = StorageObject::query()
            ->whereNull('deleted_at')
            ->where('retention_mode', 'default')
            ->whereNotNull('delete_eligible_at')
            ->where('delete_eligible_at', '<=', now());

        return match ($ruleKey) {
            'large_after_7d' => $query
                ->where('size_bytes', '>', (int) $policy->large_file_threshold_bytes)
                ->when(! $policy->large_file_rule_enabled, fn ($builder) => $builder->whereRaw('1 = 0')),
            'small_after_30d' => $query
                ->where('size_bytes', '<=', (int) $policy->small_file_threshold_bytes)
                ->when(! $policy->small_file_rule_enabled, fn ($builder) => $builder->whereRaw('1 = 0')),
            'manual' => $query,
            default => throw new InvalidArgumentException('Unsupported cleanup rule.'),
        };
    }

    protected function deleteBinaryKeepMessage(StorageObject $storageObject, string $ruleKey, ?int $actorId): bool
    {
        return DB::transaction(function () use ($actorId, $ruleKey, $storageObject): bool {
            $storageObject = StorageObject::query()
                ->whereKey($storageObject->getKey())
                ->lockForUpdate()
                ->first();

            if (! $storageObject || $storageObject->deleted_at) {
                return false;
            }

            Storage::disk(config('uploads.disk'))->delete($storageObject->disk_path);

            $before = $storageObject->toArray();

            $storageObject->forceFill([
                'deleted_at' => now(),
                'deleted_reason' => match ($ruleKey) {
                    'large_after_7d' => 'policy_large_after_7d',
                    'small_after_30d' => 'policy_small_after_30d',
                    default => 'manual_cleanup',
                },
            ])->save();

            $counter = StorageUsageCounter::query()->first() ?? new StorageUsageCounter();
            $counter->forceFill([
                'deleted_bytes_total' => (int) $counter->deleted_bytes_total + (int) $storageObject->size_bytes,
                'updated_at' => now(),
            ])->save();

            $this->storageAuditService->log(
                $actorId,
                'storage_object',
                $storageObject->id,
                'deleted_by_policy',
                $before,
                $storageObject->fresh()->toArray(),
            );

            return true;
        });
    }

    protected function recalculateDeleteEligibility(int $sizeBytes, StoragePolicy $policy): ?\Illuminate\Support\Carbon
    {
        if (! $policy->auto_cleanup_enabled) {
            return null;
        }

        if ($sizeBytes > (int) $policy->large_file_threshold_bytes && $policy->large_file_rule_enabled) {
            return now()->addDays((int) $policy->large_file_delete_after_days);
        }

        if ($sizeBytes <= (int) $policy->small_file_threshold_bytes && $policy->small_file_rule_enabled) {
            return now()->addDays((int) $policy->small_file_delete_after_days);
        }

        return null;
    }

    protected function recalculateDefaultObjectEligibility(StoragePolicy $policy): int
    {
        $updatedCount = 0;

        StorageObject::query()
            ->whereNull('deleted_at')
            ->where('retention_mode', 'default')
            ->orderBy('id')
            ->chunkById(200, function ($storageObjects) use ($policy, &$updatedCount): void {
                foreach ($storageObjects as $storageObject) {
                    $storageObject->forceFill([
                        'delete_eligible_at' => $this->deleteEligibleAtForObject($storageObject, $policy),
                    ])->save();

                    $updatedCount++;
                }
            });

        return $updatedCount;
    }

    protected function deleteEligibleAtForObject(StorageObject $storageObject, StoragePolicy $policy): ?\Illuminate\Support\Carbon
    {
        if (! $policy->auto_cleanup_enabled) {
            return null;
        }

        $baseTime = $storageObject->created_at ?? now();

        if ((int) $storageObject->size_bytes > (int) $policy->large_file_threshold_bytes && $policy->large_file_rule_enabled) {
            return $baseTime->copy()->addDays((int) $policy->large_file_delete_after_days);
        }

        if ((int) $storageObject->size_bytes <= (int) $policy->small_file_threshold_bytes && $policy->small_file_rule_enabled) {
            return $baseTime->copy()->addDays((int) $policy->small_file_delete_after_days);
        }

        return null;
    }
}
