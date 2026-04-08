<?php

namespace App\Services\Realtime;

use App\Events\Domain\ConversationTypingStarted;
use App\Events\Domain\ConversationTypingStopped;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Conversations\ConversationMemberService;
use Illuminate\Support\Facades\Cache;

class TypingService
{
    public const TYPING_TTL_SECONDS = 5;

    public function __construct(
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function startTyping(Conversation $conversation, User $user, ?string $deviceUuid = null): array
    {
        $this->conversationMemberService->requireActiveMembership($conversation, $user->getKey());

        $cacheKey = $this->cacheKey($conversation->getKey(), $user->getKey());
        $expiresAt = now()->addSeconds(self::TYPING_TTL_SECONDS);

        Cache::put($cacheKey, [
            'conversation_id' => $conversation->getKey(),
            'user_id' => $user->getKey(),
            'device_uuid' => $deviceUuid,
            'updated_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
        ], $expiresAt);

        event(new ConversationTypingStarted($conversation, $user, $deviceUuid));

        return [
            'typing_key' => $cacheKey,
            'ttl_seconds' => self::TYPING_TTL_SECONDS,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function stopTyping(Conversation $conversation, User $user, ?string $deviceUuid = null): array
    {
        $this->conversationMemberService->requireActiveMembership($conversation, $user->getKey());

        $cacheKey = $this->cacheKey($conversation->getKey(), $user->getKey());
        Cache::forget($cacheKey);

        event(new ConversationTypingStopped($conversation, $user, $deviceUuid));

        return [
            'typing_key' => $cacheKey,
            'stopped' => true,
        ];
    }

    public function cacheKey(int $conversationId, int $userId): string
    {
        return "typing:conversation:{$conversationId}:{$userId}";
    }
}
