<?php

namespace App\Services\Conversations;

use App\Models\Conversation;
use App\Models\ConversationMember;
use Illuminate\Auth\Access\AuthorizationException;

class ConversationMemberService
{
    public function requireActiveMembership(Conversation $conversation, int $userId): ConversationMember
    {
        return $conversation->members()
            ->where('user_id', $userId)
            ->where('membership_state', 'active')
            ->firstOrFail();
    }

    /**
     * @throws AuthorizationException
     */
    public function ensureGroupManager(Conversation $conversation, int $userId): ConversationMember
    {
        $membership = $this->requireActiveMembership($conversation, $userId);

        if ($conversation->type !== 'group' || ! in_array($membership->role, ['owner', 'admin'], true)) {
            throw new AuthorizationException('You are not allowed to manage this group.');
        }

        return $membership;
    }
}
