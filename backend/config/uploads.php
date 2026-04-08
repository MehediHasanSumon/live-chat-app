<?php

return [
    'disk' => env('UPLOADS_DISK', 'local'),
    'signed_download_ttl_minutes' => (int) env('UPLOADS_SIGNED_DOWNLOAD_TTL_MINUTES', 10),
    'max_upload_kb' => (int) env('UPLOADS_MAX_UPLOAD_KB', 20 * 1024),
    'ffprobe_binary' => env('FFPROBE_BINARY', 'ffprobe'),
    'clamav' => [
        'enabled' => (bool) env('CLAMAV_ENABLED', false),
        'binary' => env('CLAMAV_BINARY', 'clamscan'),
    ],
    'allowed_mime_types' => [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/webm',
        'audio/wav',
        'application/pdf',
        'text/plain',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
    ],
];
