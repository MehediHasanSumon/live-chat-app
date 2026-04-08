<?php

namespace App\Providers;

use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageDeleted;
use App\Events\Domain\ConversationMessageUpdated;
use App\Events\Domain\ConversationReactionChanged;
use App\Events\Domain\ConversationTypingStarted;
use App\Events\Domain\ConversationTypingStopped;
use App\Events\Domain\UserCallSignaled;
use App\Events\Domain\UserNotificationDispatched;
use App\Listeners\BroadcastConversationMessageCreated;
use App\Listeners\BroadcastConversationMessageDeleted;
use App\Listeners\BroadcastConversationMessageUpdated;
use App\Listeners\BroadcastConversationReactionChanged;
use App\Listeners\BroadcastConversationTypingStarted;
use App\Listeners\BroadcastConversationTypingStopped;
use App\Listeners\BroadcastUserCallSignal;
use App\Listeners\BroadcastUserNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        ConversationMessageCreated::class => [
            BroadcastConversationMessageCreated::class,
        ],
        ConversationMessageUpdated::class => [
            BroadcastConversationMessageUpdated::class,
        ],
        ConversationMessageDeleted::class => [
            BroadcastConversationMessageDeleted::class,
        ],
        ConversationReactionChanged::class => [
            BroadcastConversationReactionChanged::class,
        ],
        ConversationTypingStarted::class => [
            BroadcastConversationTypingStarted::class,
        ],
        ConversationTypingStopped::class => [
            BroadcastConversationTypingStopped::class,
        ],
        UserNotificationDispatched::class => [
            BroadcastUserNotification::class,
        ],
        UserCallSignaled::class => [
            BroadcastUserCallSignal::class,
        ],
    ];
}
