<?php

$allowedPublishSources = array_values(array_filter(array_map(
    static fn (string $source): string => trim($source),
    explode(',', (string) env('LIVEKIT_ALLOWED_PUBLISH_SOURCES', 'camera,microphone'))
)));

return [
    'url' => env('LIVEKIT_URL', 'http://127.0.0.1:7880'),
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),
    'ca_bundle' => env('LIVEKIT_CA_BUNDLE'),
    'token_ttl' => (int) env('LIVEKIT_TOKEN_TTL', 3600),
    'default_room_empty_timeout' => (int) env('LIVEKIT_ROOM_EMPTY_TIMEOUT', 600),
    'default_room_max_participants' => (int) env('LIVEKIT_ROOM_MAX_PARTICIPANTS', 12),
    'default_room_max_video_publishers' => (int) env('LIVEKIT_ROOM_MAX_VIDEO_PUBLISHERS', 4),
    'allowed_publish_sources' => $allowedPublishSources === [] ? ['camera', 'microphone'] : $allowedPublishSources,
    'default_metadata_claims' => [
        'app' => env('APP_NAME', 'Laravel'),
    ],
];
