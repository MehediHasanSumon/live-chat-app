<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Request Debouncing
    |--------------------------------------------------------------------------
    |
    | Configure which routes and requests should be debounced to prevent
    | duplicate submissions and improve system performance
    |
    */

    'enabled' => env('DEBOUNCE_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Default Timeout
    |--------------------------------------------------------------------------
    |
    | Default debounce timeout in seconds for requests not explicitly configured
    |
    */
    'default_timeout' => env('DEBOUNCE_DEFAULT_TIMEOUT', 2),

    /*
    |--------------------------------------------------------------------------
    | Route Patterns to Debounce
    |--------------------------------------------------------------------------
    |
    | Glob patterns for routes that should have debouncing enabled
    |
    */
    'routes' => [
        'api/conversations/*',
        'api/messages/*',
        'api/calls/*',
        'api/upload/*',
        'api/reactions/*',
    ],

    /*
    |--------------------------------------------------------------------------
    | Endpoint-Specific Timeouts
    |--------------------------------------------------------------------------
    |
    | Maps route names to specific debounce timeouts
    |
    */
    'timeouts' => [
        // Conversations
        'conversations.store' => 2,
        'conversations.update' => 2,
        'conversations.destroy' => 2,

        // Messages
        'messages.store' => 2,
        'messages.update' => 2,
        'messages.delete' => 2,

        // Reactions
        'reactions.store' => 1,
        'reactions.destroy' => 1,

        // Uploads
        'upload.store' => 3,
        'upload.attach' => 2,

        // Calls
        'calls.store' => 2,
        'calls.update' => 1,

        // User settings
        'settings.update' => 2,

        // Privacy
        'privacy.block' => 1,
        'privacy.unblock' => 1,
    ],

    /*
    |--------------------------------------------------------------------------
    | Exclusions
    |--------------------------------------------------------------------------
    |
    | Routes that should NOT be debounced even if they match patterns above
    |
    */
    'exclude' => [
        'api/health',
        'api/ping',
        'api/user/me',
        'api/me',
        'api/conversations/direct',
        'api/conversations/*/messages/*',
        'api/webhooks/livekit',
    ],

    /*
    |--------------------------------------------------------------------------
    | Cache Store
    |--------------------------------------------------------------------------
    |
    | Cache store used for tracking debounced requests
    | Use 'redis' in production for better performance
    |
    */
    'cache_store' => env('DEBOUNCE_CACHE_STORE', 'redis'),

];
