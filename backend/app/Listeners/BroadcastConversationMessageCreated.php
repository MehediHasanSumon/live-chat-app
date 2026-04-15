<?php

namespace App\Listeners;

use App\Events\Broadcasts\ConversationRealtimeEvent;
use App\Events\Broadcasts\UserRealtimeEvent;
use App\Events\Domain\ConversationMessageCreated;
use App\Http\Resources\MessageResource;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BroadcastConversationMessageCreated
{
    public function handle(ConversationMessageCreated $event): void
    {
        $message = $event->message->fresh([
            'conversation.members',
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        $resource = (new MessageResource($message))->resolve(new Request());

        broadcast(new ConversationRealtimeEvent(
            $message->conversation_id,
            'message.created',
            [
                'message' => $resource,
            ],
        ));

        $message->conversation->members
            ->filter(fn ($membership): bool => (int) $membership->user_id !== (int) $message->sender_id)
            ->each(function ($membership) use ($message, $resource): void {
                broadcast(new UserRealtimeEvent(
                    (int) $membership->user_id,
                    'message.created',
                    [
                        'message' => $resource,
                        'message_id' => (int) $message->getKey(),
                        'conversation_id' => (int) $message->conversation_id,
                        'sender_id' => (int) $message->sender_id,
                        'title' => $message->sender?->name ?: 'New message',
                        'body' => $this->messagePreview($message->type, $message->display_text ?? $message->text_body),
                        'type' => 'new_message',
                    ],
                ));
            });
    }

    protected function messagePreview(string $type, ?string $body): string
    {
        return match ($type) {
            'text' => Str::limit((string) $body, 255),
            'image' => 'Sent a photo',
            'video' => 'Sent a video',
            'voice' => 'Sent a voice message',
            'file' => 'Sent a file',
            'gif' => 'Sent a GIF',
            default => 'Sent a message',
        };
    }
}
