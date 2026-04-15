<?php

$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:3000')))
)));

return [
    'paths' => [
        'api/*',
        'broadcasting/auth',
        'login',
        'logout',
        'register',
        'forgot-password',
        'reset-password/verify-code',
        'reset-password',
        'email/verification/send',
        'email/verification/verify',
        'sanctum/csrf-cookie',
    ],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins === [] ? ['http://localhost:3000'] : $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => env('CORS_SUPPORTS_CREDENTIALS', true),
];
