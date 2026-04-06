<?php

return [
    'url' => env('LIVEKIT_URL', 'http://127.0.0.1:7880'),
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),
    'token_ttl' => (int) env('LIVEKIT_TOKEN_TTL', 3600),
    'default_room_empty_timeout' => (int) env('LIVEKIT_ROOM_EMPTY_TIMEOUT', 600),
    'default_room_max_participants' => (int) env('LIVEKIT_ROOM_MAX_PARTICIPANTS', 12),
    'default_metadata_claims' => [
        'app' => env('APP_NAME', 'Laravel'),
    ],
];
