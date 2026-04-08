<?php

namespace App\Events\Domain;

use App\Models\CallRoom;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationCallStateChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public CallRoom $callRoom,
        public string $action,
    ) {
    }
}
