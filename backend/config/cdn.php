<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CDN Configuration
    |--------------------------------------------------------------------------
    |
    | Configure CDN settings for static assets and file delivery
    |
    */

    'enabled' => env('CDN_ENABLED', false),

    'driver' => env('CDN_DRIVER', 'cloudflare'), // 'cloudflare', 'aws-cloudfront', 'bunny', 'custom'

    /*
    |--------------------------------------------------------------------------
    | Cloudflare CDN
    |--------------------------------------------------------------------------
    */
    'cloudflare' => [
        'enabled' => env('CLOUDFLARE_CDN_ENABLED', false),
        'zone_id' => env('CLOUDFLARE_ZONE_ID'),
        'api_token' => env('CLOUDFLARE_API_TOKEN'),
        'account_id' => env('CLOUDFLARE_ACCOUNT_ID'),
        'url' => env('CLOUDFLARE_CDN_URL'), // e.g., https://cdn.example.com
        'cache_ttl' => env('CLOUDFLARE_CACHE_TTL', 86400), // 24 hours
        'purge_on_upload' => env('CLOUDFLARE_PURGE_ON_UPLOAD', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | AWS CloudFront CDN
    |--------------------------------------------------------------------------
    */
    'aws_cloudfront' => [
        'enabled' => env('CLOUDFRONT_ENABLED', false),
        'distribution_id' => env('CLOUDFRONT_DISTRIBUTION_ID'),
        'key_pair_id' => env('CLOUDFRONT_KEY_PAIR_ID'),
        'private_key_path' => env('CLOUDFRONT_PRIVATE_KEY_PATH'),
        'domain' => env('CLOUDFRONT_DOMAIN'),
        'cache_ttl' => env('CLOUDFRONT_CACHE_TTL', 86400),
    ],

    /*
    |--------------------------------------------------------------------------
    | Bunny CDN
    |--------------------------------------------------------------------------
    */
    'bunny' => [
        'enabled' => env('BUNNY_CDN_ENABLED', false),
        'zone_name' => env('BUNNY_ZONE_NAME'),
        'api_key' => env('BUNNY_API_KEY'),
        'storage_zone' => env('BUNNY_STORAGE_ZONE'),
        'storage_api_key' => env('BUNNY_STORAGE_API_KEY'),
        'url' => env('BUNNY_CDN_URL'),
        'cache_ttl' => env('BUNNY_CACHE_TTL', 86400),
    ],

    /*
    |--------------------------------------------------------------------------
    | Asset Types Configuration
    |--------------------------------------------------------------------------
    */
    'asset_types' => [
        'images' => [
            'cdn_enabled' => true,
            'cache_ttl' => 2592000, // 30 days
            'compress' => true,
            'formats' => ['webp', 'jpg', 'png'],
        ],
        'videos' => [
            'cdn_enabled' => true,
            'cache_ttl' => 604800, // 7 days
            'stream' => true,
        ],
        'documents' => [
            'cdn_enabled' => false,
            'cache_ttl' => 86400, // 1 day
        ],
        'audio' => [
            'cdn_enabled' => true,
            'cache_ttl' => 604800, // 7 days
            'stream' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Caching Headers
    |--------------------------------------------------------------------------
    */
    'cache_headers' => [
        'static' => 'public, max-age=2592000, immutable', // 30 days
        'images' => 'public, max-age=2592000, immutable',
        'videos' => 'public, max-age=604800',
        'documents' => 'public, max-age=86400',
        'html' => 'public, max-age=3600, must-revalidate',
    ],

    /*
    |--------------------------------------------------------------------------
    | URL Rewriting
    |--------------------------------------------------------------------------
    */
    'url_rewrite' => env('CDN_URL_REWRITE', true),

    'url_prefix' => env('CDN_URL_PREFIX', 'cdn'),

    'custom_domain' => env('CDN_CUSTOM_DOMAIN'), // e.g., cdn.example.com

];
