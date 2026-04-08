<?php

namespace App\Events\Domain;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationTypingStopped
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Conversation $conversation,
        public User $user,
        public ?string $deviceUuid = null,
    ) {
    }
}
