<?php

use App\Models\ConversationMember;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id): bool {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('user.{userId}', function ($user, $userId): bool {
    return (int) $user->id === (int) $userId;
});

Broadcast::channel('conversation.{conversationId}', function ($user, $conversationId): array|bool {
    $isMember = ConversationMember::query()
        ->where('conversation_id', $conversationId)
        ->where('user_id', $user->getAuthIdentifier())
        ->where('membership_state', 'active')
        ->exists();

    if (! $isMember) {
        return false;
    }

    return [
        'id' => $user->getAuthIdentifier(),
        'name' => $user->name,
        'avatar_object_id' => $user->avatar_object_id,
    ];
});
