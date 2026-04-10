<?php

namespace App\Services\Cache;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class CacheService
{
    /**
     * Cache key prefixes for organized cache management
     */
    public const PREFIX_CONVERSATION = 'conv:';
    public const PREFIX_MESSAGES = 'msgs:';
    public const PREFIX_USER = 'user:';
    public const PREFIX_CALL = 'call:';
    public const PREFIX_STORAGE = 'storage:';
    public const PREFIX_PRESENCE = 'presence:';
    public const PREFIX_TYPING = 'typing:';

    /**
     * Cache TTLs in seconds
     */
    public const TTL_VERY_SHORT = 60; // 1 minute
    public const TTL_SHORT = 300; // 5 minutes
    public const TTL_MEDIUM = 3600; // 1 hour
    public const TTL_LONG = 86400; // 24 hours
    public const TTL_VERY_LONG = 604800; // 7 days

    /**
     * Get or store conversation details
     */
    public function getOrStoreConversation(int $conversationId, callable $callback, int $ttl = self::TTL_MEDIUM)
    {
        $key = self::PREFIX_CONVERSATION . $conversationId;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget conversation cache
     */
    public function forgetConversation(int $conversationId): void
    {
        Cache::forget(self::PREFIX_CONVERSATION . $conversationId);
    }

    /**
     * Get or store conversation members
     */
    public function getOrStoreConversationMembers(int $conversationId, callable $callback, int $ttl = self::TTL_MEDIUM)
    {
        $key = self::PREFIX_CONVERSATION . $conversationId . ':members';
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget conversation members cache
     */
    public function forgetConversationMembers(int $conversationId): void
    {
        Cache::forget(self::PREFIX_CONVERSATION . $conversationId . ':members');
    }

    /**
     * Get or store message list (paginated)
     */
    public function getOrStoreMessageList(int $conversationId, int $cursor = null, int $limit = 50, callable $callback, int $ttl = self::TTL_SHORT)
    {
        $cursorSegment = $cursor ? ':' . $cursor : ':first';
        $key = self::PREFIX_MESSAGES . $conversationId . $cursorSegment . ':' . $limit;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget all message cache for conversation
     */
    public function forgetConversationMessages(int $conversationId): void
    {
        // Invalidate all pagination cursors
        Cache::tags([self::PREFIX_MESSAGES . $conversationId])->flush();
    }

    /**
     * Get or store user profile
     */
    public function getOrStoreUserProfile(int $userId, callable $callback, int $ttl = self::TTL_MEDIUM)
    {
        $key = self::PREFIX_USER . $userId . ':profile';
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget user profile cache
     */
    public function forgetUserProfile(int $userId): void
    {
        Cache::forget(self::PREFIX_USER . $userId . ':profile');
    }

    /**
     * Get or store user settings
     */
    public function getOrStoreUserSettings(int $userId, callable $callback, int $ttl = self::TTL_MEDIUM)
    {
        $key = self::PREFIX_USER . $userId . ':settings';
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget user settings cache
     */
    public function forgetUserSettings(int $userId): void
    {
        Cache::forget(self::PREFIX_USER . $userId . ':settings');
    }

    /**
     * Get or store call room details
     */
    public function getOrStoreCallRoom(string $callRoomId, callable $callback, int $ttl = self::TTL_SHORT)
    {
        $key = self::PREFIX_CALL . $callRoomId;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget call room cache
     */
    public function forgetCallRoom(string $callRoomId): void
    {
        Cache::forget(self::PREFIX_CALL . $callRoomId);
    }

    /**
     * Get or store storage object details
     */
    public function getOrStoreStorageObject(string $uuid, callable $callback, int $ttl = self::TTL_LONG)
    {
        $key = self::PREFIX_STORAGE . $uuid;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget storage object cache
     */
    public function forgetStorageObject(string $uuid): void
    {
        Cache::forget(self::PREFIX_STORAGE . $uuid);
    }

    /**
     * Get or store user storage quota
     */
    public function getOrStoreUserStorageQuota(int $userId, callable $callback, int $ttl = self::TTL_MEDIUM)
    {
        $key = self::PREFIX_STORAGE . 'quota:' . $userId;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget user storage quota cache
     */
    public function forgetUserStorageQuota(int $userId): void
    {
        Cache::forget(self::PREFIX_STORAGE . 'quota:' . $userId);
    }

    /**
     * Get or store API response list (generic)
     */
    public function getOrStoreList(string $resource, array $filters = [], callable $callback, int $ttl = self::TTL_SHORT)
    {
        $filterHash = md5(json_encode(sort($filters)));
        $key = $resource . ':list:' . $filterHash;
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Forget all cache for a resource
     */
    public function forgetResource(string $resource): void
    {
        Cache::tags([$resource])->flush();
    }

    /**
     * Increment counter with TTL
     */
    public function incrementCounter(string $key, int $ttl = self::TTL_VERY_SHORT, int $amount = 1): int
    {
        // Set initial value if doesn't exist
        if (!Cache::has($key)) {
            Cache::put($key, $amount, $ttl);
            return $amount;
        }

        return Cache::increment($key, $amount);
    }

    /**
     * Check if should apply rate limit
     */
    public function checkRateLimit(string $key, int $maxAttempts, int $ttl = self::TTL_VERY_SHORT): bool
    {
        $count = $this->incrementCounter($key, $ttl);
        return $count <= $maxAttempts;
    }

    /**
     * Get cache statistics
     */
    public function getStats(): array
    {
        // This is more complex with Redis, simplified here
        return [
            'store' => Cache::getStore()::class,
            'connection' => config('cache.default'),
        ];
    }

    /**
     * Clear all application cache
     */
    public function flush(): void
    {
        Cache::flush();
    }

    /**
     * Batch invalidate multiple keys
     */
    public function forgetMany(array $keys): void
    {
        Cache::deleteMultiple($keys);
    }

    /**
     * Set with tags for grouped invalidation
     */
    public function rememberWithTags(string $key, array $tags, int $ttl, callable $callback)
    {
        return Cache::tags($tags)->remember($key, $ttl, $callback);
    }
}
