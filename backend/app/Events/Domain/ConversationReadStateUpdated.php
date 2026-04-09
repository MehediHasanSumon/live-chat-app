<?php

namespace App\Events\Domain;

use App\Models\Conversation;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationReadStateUpdated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Conversation $conversation,
        public int $userId,
        public int $lastReadSeq,
    ) {
    }
}
