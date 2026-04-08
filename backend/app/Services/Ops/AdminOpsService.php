<?php

namespace App\Services\Ops;

use App\Models\CallRoom;
use App\Models\NotificationOutbox;
use App\Services\Storage\StorageCleanupService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class AdminOpsService
{
    public function __construct(
        protected StorageCleanupService $storageCleanupService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        $database = $this->checkDatabase();
        $cache = $this->checkCache();
        $queue = $this->checkQueue();
        $reverb = $this->checkReverb();
        $livekit = $this->checkLiveKit();

        $statuses = [
            $database['status'],
            $cache['status'],
            $queue['status'],
            $reverb['status'],
            $livekit['status'],
        ];

        $overallStatus = in_array('down', $statuses, true)
            ? 'down'
            : (in_array('degraded', $statuses, true) ? 'degraded' : 'ok');

        return [
            'overall_status' => $overallStatus,
            'checked_at' => now()->toIso8601String(),
            'services' => [
                'database' => $database,
                'cache' => $cache,
                'queue' => $queue,
                'reverb' => $reverb,
                'livekit' => $livekit,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function status(): array
    {
        return [
            'checked_at' => now()->toIso8601String(),
            'app' => [
                'name' => config('app.name'),
                'env' => config('app.env'),
                'debug' => (bool) config('app.debug'),
                'url' => config('app.url'),
            ],
            'queues' => [
                'connection' => config('queue.default'),
                'names' => config('queue.queues', []),
                'pending_jobs' => $this->pendingJobsByQueue(),
                'failed_jobs' => $this->failedJobCount(),
            ],
            'notifications' => [
                'outbox' => [
                    'queued' => NotificationOutbox::query()->where('status', 'queued')->count(),
                    'sent' => NotificationOutbox::query()->where('status', 'sent')->count(),
                    'suppressed' => NotificationOutbox::query()->where('status', 'suppressed')->count(),
                    'failed' => NotificationOutbox::query()->where('status', 'failed')->count(),
                    'scheduled_due' => NotificationOutbox::query()
                        ->where('status', 'queued')
                        ->whereNotNull('schedule_at')
                        ->where('schedule_at', '<=', now())
                        ->count(),
                ],
            ],
            'calls' => [
                'active' => CallRoom::query()->whereIn('status', ['initiated', 'ringing', 'active'])->count(),
                'ended' => CallRoom::query()->where('status', 'ended')->count(),
            ],
            'storage' => [
                'usage' => $this->storageCleanupService->usage()->toArray(),
                'policy' => $this->storageCleanupService->policy()->toArray(),
            ],
            'reverb' => [
                'connection' => config('broadcasting.default'),
                'host' => config('reverb.apps.apps.0.options.host'),
                'port' => config('reverb.apps.apps.0.options.port'),
                'scheme' => config('reverb.apps.apps.0.options.scheme'),
                'configured' => $this->isReverbConfigured(),
            ],
            'livekit' => [
                'url' => config('livekit.url'),
                'configured' => $this->isLiveKitConfigured(),
            ],
            'horizon' => [
                'enabled' => class_exists(\Laravel\Horizon\Horizon::class),
                'configured' => is_array(config('horizon.environments')),
                'defaults' => config('horizon.defaults'),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function checkDatabase(): array
    {
        try {
            DB::select('select 1 as ready');

            return [
                'status' => 'ok',
                'connection' => config('database.default'),
            ];
        } catch (Throwable $exception) {
            return [
                'status' => 'down',
                'connection' => config('database.default'),
                'message' => $exception->getMessage(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function checkCache(): array
    {
        $store = config('cache.default');
        $key = 'ops:health:'.str()->uuid();

        try {
            Cache::put($key, 'ok', 10);
            $value = Cache::get($key);
            Cache::forget($key);

            return [
                'status' => $value === 'ok' ? 'ok' : 'degraded',
                'store' => $store,
            ];
        } catch (Throwable $exception) {
            return [
                'status' => 'down',
                'store' => $store,
                'message' => $exception->getMessage(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function checkQueue(): array
    {
        $connection = config('queue.default');

        try {
            return [
                'status' => 'ok',
                'connection' => $connection,
                'pending_jobs' => array_sum($this->pendingJobsByQueue()),
                'failed_jobs' => $this->failedJobCount(),
            ];
        } catch (Throwable $exception) {
            return [
                'status' => 'down',
                'connection' => $connection,
                'message' => $exception->getMessage(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function checkReverb(): array
    {
        return [
            'status' => $this->isReverbConfigured() ? 'ok' : 'degraded',
            'configured' => $this->isReverbConfigured(),
            'driver' => config('broadcasting.default'),
            'host' => config('reverb.apps.apps.0.options.host'),
            'port' => config('reverb.apps.apps.0.options.port'),
            'scheme' => config('reverb.apps.apps.0.options.scheme'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function checkLiveKit(): array
    {
        return [
            'status' => $this->isLiveKitConfigured() ? 'ok' : 'degraded',
            'configured' => $this->isLiveKitConfigured(),
            'url' => config('livekit.url'),
        ];
    }

    /**
     * @return array<string, int>
     */
    protected function pendingJobsByQueue(): array
    {
        if (! DB::getSchemaBuilder()->hasTable('jobs')) {
            return [];
        }

        return DB::table('jobs')
            ->select('queue', DB::raw('count(*) as total'))
            ->groupBy('queue')
            ->pluck('total', 'queue')
            ->map(fn ($count): int => (int) $count)
            ->all();
    }

    protected function failedJobCount(): int
    {
        if (! DB::getSchemaBuilder()->hasTable('failed_jobs')) {
            return 0;
        }

        return (int) DB::table('failed_jobs')->count();
    }

    protected function isReverbConfigured(): bool
    {
        return filled(config('reverb.apps.apps.0.key'))
            && filled(config('reverb.apps.apps.0.secret'))
            && filled(config('reverb.apps.apps.0.app_id'))
            && filled(config('reverb.apps.apps.0.options.host'))
            && filled(config('reverb.apps.apps.0.options.port'));
    }

    protected function isLiveKitConfigured(): bool
    {
        return filled(config('livekit.url'))
            && filled(config('livekit.api_key'))
            && filled(config('livekit.api_secret'));
    }
}
