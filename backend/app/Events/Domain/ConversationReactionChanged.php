<?php

namespace App\Events\Domain;

use App\Models\Message;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationReactionChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Message $message,
        public string $action,
        public string $emoji,
    ) {
    }
}
