<?php

return [
    'domain' => env('HORIZON_DOMAIN'),
    'path' => env('HORIZON_PATH', 'horizon'),
    'use' => env('HORIZON_USE', env('REDIS_QUEUE_CONNECTION', 'default')),
    'prefix' => env('HORIZON_PREFIX', str((string) env('APP_NAME', 'laravel'))->slug('_').'_horizon:'),
    'waits' => [
        env('HORIZON_USE', env('REDIS_QUEUE_CONNECTION', 'default')) => env('HORIZON_WAIT_SECONDS', 60),
    ],
    'trim' => [
        'recent' => 60,
        'pending' => 60,
        'completed' => 60,
        'recent_failed' => 10080,
        'failed' => 10080,
        'monitored' => 10080,
    ],
    'silenced' => [],
    'metrics' => [
        'trim_snapshots' => [
            'job' => 24,
            'queue' => 24,
        ],
    ],
    'fast_termination' => false,
    'memory_limit' => 64,
    'defaults' => [
        'chat-supervisor' => [
            'connection' => env('HORIZON_USE', env('REDIS_QUEUE_CONNECTION', 'default')),
            'queue' => array_values(array_filter([
                config('queue.queues.high'),
                config('queue.queues.default'),
                config('queue.queues.notifications'),
                config('queue.queues.media'),
            ])),
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => (int) env('HORIZON_MAX_PROCESSES', 4),
            'maxTime' => 0,
            'maxJobs' => 0,
            'memory' => (int) env('HORIZON_SUPERVISOR_MEMORY', 256),
            'tries' => 3,
            'timeout' => 90,
            'nice' => 0,
        ],
    ],
    'environments' => [
        'production' => [
            'chat-supervisor' => [
                'maxProcesses' => (int) env('HORIZON_MAX_PROCESSES', 4),
                'balanceMaxShift' => 1,
                'balanceCooldown' => 3,
            ],
        ],
        'local' => [
            'chat-supervisor' => [
                'maxProcesses' => (int) env('HORIZON_LOCAL_MAX_PROCESSES', 2),
            ],
        ],
    ],
];
