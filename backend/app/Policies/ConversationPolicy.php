<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        return $conversation->members()
            ->where('user_id', $user->getKey())
            ->whereIn('membership_state', ['active', 'request_pending'])
            ->exists();
    }

    public function manageGroup(User $user, Conversation $conversation): bool
    {
        if ($conversation->type !== 'group') {
            return false;
        }

        return $conversation->members()
            ->where('user_id', $user->getKey())
            ->where('membership_state', 'active')
            ->exists();
    }
}
