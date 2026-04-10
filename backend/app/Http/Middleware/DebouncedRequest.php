<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class DebouncedRequest
{
    /**
     * Handle an incoming request with debouncing
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!config('debounce.enabled', true) || app()->runningUnitTests()) {
            return $next($request);
        }

        // Only debounce specific methods and routes
        if (!$this->shouldDebounce($request)) {
            return $next($request);
        }

        $debounceKey = $this->generateDebounceKey($request);
        $debounceTime = $this->getDebounceTime($request);

        // Check if request was recently made
        if (Cache::has($debounceKey)) {
            Log::info('Debounced request', [
                'url' => $request->getPathInfo(),
                'user_id' => $request->user()?->id,
                'key' => $debounceKey,
            ]);

            return response()->json([
                'message' => 'Duplicate request detected. Please try again later.',
                'status' => 429,
            ], 429);
        }

        // Store debounce key for configured duration
        Cache::put($debounceKey, true, $debounceTime);

        return $next($request);
    }

    /**
     * Determine if request should be debounced
     */
    protected function shouldDebounce(Request $request): bool
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
            return false;
        }

        if ($request->hasHeader('X-Skip-Debounce')) {
            return false;
        }

        if ($request->filled('client_uuid')) {
            return false;
        }

        if ($request->is(config('debounce.exclude', []))) {
            return false;
        }

        $debounceRoutes = config('debounce.routes', []);

        // Check route patterns
        foreach ($debounceRoutes as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate unique debounce key for request
     */
    protected function generateDebounceKey(Request $request): string
    {
        $userId = $request->user()?->id ?? 'anonymous';
        $method = $request->method();
        $path = $request->getPathInfo();

        // Use request body or query for fingerprint
        $fingerprint = md5(json_encode($request->all()));

        return "debounce:{$userId}:{$method}:{$path}:{$fingerprint}";
    }

    /**
     * Get debounce time in seconds for this request
     */
    protected function getDebounceTime(Request $request): int
    {
        // Check for custom X-Debounce-Duration header
        if ($request->hasHeader('X-Debounce-Duration')) {
            return intval($request->header('X-Debounce-Duration'));
        }

        $debounceMap = config('debounce.timeouts', [
            'conversations.store' => 2,
            'messages.store' => 2,
            'messages.update' => 2,
            'messages.delete' => 2,
            'reactions.store' => 1,
            'upload.store' => 3,
            'calls.store' => 2,
        ]);

        $route = $request->route()?->getName();

        return $debounceMap[$route] ?? config('debounce.default_timeout', 2);
    }
}
