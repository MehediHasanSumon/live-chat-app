<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Broadcasts\UserRealtimeEvent;
use App\Events\Domain\ConversationTypingStarted;
use App\Models\ConversationMember;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class BroadcastConversationTypingStarted
{
    public function handle(ConversationTypingStarted $event): void
    {
        $payload = [
            'conversation_id' => $event->conversation->getKey(),
            'user' => (new UserResource($event->user))->resolve(new Request()),
            'device_uuid' => $event->deviceUuid,
        ];

        broadcast(new ConversationRealtimeEvent(
            $event->conversation->getKey(),
            'typing.started',
            $payload,
            true,
        ))->toOthers();

        ConversationMember::query()
            ->where('conversation_id', $event->conversation->getKey())
            ->where('membership_state', 'active')
            ->where('user_id', '!=', $event->user->getKey())
            ->pluck('user_id')
            ->each(function ($userId) use ($payload): void {
                broadcast(new UserRealtimeEvent(
                    (int) $userId,
                    'typing.started',
                    $payload,
                ))->toOthers();
            });
    }
}
