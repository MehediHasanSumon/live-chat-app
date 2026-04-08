<?php

namespace App\Services\Messages;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\MessageEdit;
use App\Models\MessageHiddenForUser;
use App\Services\Conversations\ConversationMemberService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class MessageService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    public function listForUser(Conversation $conversation, int $userId, ?int $cursor = null, int $limit = 50): Collection
    {
        $this->conversationMemberService->requireActiveMembership($conversation, $userId);

        $query = Message::query()
            ->where('conversation_id', $conversation->getKey())
            ->whereDoesntHave('hiddenForUsers', function ($builder) use ($userId): void {
                $builder->where('user_id', $userId);
            });

        if ($cursor !== null) {
            $query->where('seq', '<', $cursor);
        }

        return $query
            ->with([
                'sender',
                'replyTo.sender',
                'reactions.user',
                'attachments.storageObject',
            ])
            ->orderByDesc('seq')
            ->limit($limit)
            ->get()
            ->sortBy('seq')
            ->values();
    }

    /**
     * @return array{message: Message, created: bool}
     */
    public function sendText(
        Conversation $conversation,
        int $senderId,
        string $text,
        ?int $replyToMessageId = null,
        ?string $clientUuid = null,
    ): array {
        $this->conversationMemberService->requireActiveMembership($conversation, $senderId);

        if ($clientUuid) {
            $existing = $this->findExistingMessage($conversation->id, $senderId, $clientUuid);

            if ($existing) {
                return [
                    'message' => $this->loadMessage($existing),
                    'created' => false,
                ];
            }
        }

        $message = DB::transaction(function () use ($clientUuid, $conversation, $replyToMessageId, $senderId, $text): Message {
            $replyTo = $replyToMessageId
                ? $this->resolveReplyTarget($conversation, $senderId, $replyToMessageId)
                : null;

            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $nextSeq = (int) $lockedConversation->last_message_seq + 1;

            $message = Message::query()->create([
                'conversation_id' => $lockedConversation->getKey(),
                'seq' => $nextSeq,
                'sender_id' => $senderId,
                'client_uuid' => $clientUuid,
                'type' => 'text',
                'text_body' => trim($text),
                'reply_to_message_id' => $replyTo?->id,
                'quote_snapshot_json' => $replyTo ? $this->buildQuoteSnapshot($replyTo) : null,
                'editable_until_at' => now()->addMinutes(15),
            ]);

            $this->syncConversationAfterMessageMutation($lockedConversation, $message);
            $this->incrementUnreadCounts($lockedConversation->id, $senderId);

            return $message;
        });

        return [
            'message' => $this->loadMessage($message),
            'created' => true,
        ];
    }

    /**
     * @return array{message: Message, created: bool}
     */
    public function forward(Message $sourceMessage, Conversation $targetConversation, int $actorId, ?string $clientUuid = null): array
    {
        $this->conversationMemberService->requireActiveMembership($sourceMessage->conversation, $actorId);
        $this->conversationMemberService->requireActiveMembership($targetConversation, $actorId);

        if ($clientUuid) {
            $existing = $this->findExistingMessage($targetConversation->id, $actorId, $clientUuid);

            if ($existing) {
                return [
                    'message' => $this->loadMessage($existing),
                    'created' => false,
                ];
            }
        }

        $message = DB::transaction(function () use ($actorId, $clientUuid, $sourceMessage, $targetConversation): Message {
            $lockedConversation = Conversation::query()
                ->whereKey($targetConversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $nextSeq = (int) $lockedConversation->last_message_seq + 1;

            $message = Message::query()->create([
                'conversation_id' => $lockedConversation->getKey(),
                'seq' => $nextSeq,
                'sender_id' => $actorId,
                'client_uuid' => $clientUuid,
                'type' => $sourceMessage->type,
                'sub_type' => $sourceMessage->sub_type,
                'text_body' => $sourceMessage->text_body,
                'reply_to_message_id' => $sourceMessage->reply_to_message_id,
                'quote_snapshot_json' => $sourceMessage->quote_snapshot_json,
                'forwarded_from_message_id' => $sourceMessage->forwarded_from_message_id ?? $sourceMessage->id,
                'forwarded_from_conversation_id' => $sourceMessage->forwarded_from_conversation_id ?? $sourceMessage->conversation_id,
                'forwarded_from_user_id' => $sourceMessage->forwarded_from_user_id ?? $sourceMessage->sender_id,
                'metadata_json' => $sourceMessage->metadata_json,
                'editable_until_at' => now()->addMinutes(15),
            ]);

            $this->syncConversationAfterMessageMutation($lockedConversation, $message);
            $this->incrementUnreadCounts($lockedConversation->id, $actorId);

            return $message;
        });

        return [
            'message' => $this->loadMessage($message),
            'created' => true,
        ];
    }

    public function edit(Message $message, int $actorId, string $text): Message
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $actorId);

        if ($message->sender_id !== $actorId) {
            throw new InvalidArgumentException('Only the original sender may edit this message.');
        }

        if ($message->deleted_for_everyone_at) {
            throw new InvalidArgumentException('This message has already been unsent.');
        }

        if ($message->type !== 'text') {
            throw new InvalidArgumentException('Only text messages can be edited right now.');
        }

        if (! $message->editable_until_at || $message->editable_until_at->isPast()) {
            throw new InvalidArgumentException('The edit window has expired for this message.');
        }

        $updatedMessage = DB::transaction(function () use ($actorId, $message, $text): Message {
            $message = Message::query()
                ->whereKey($message->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $nextVersion = (int) MessageEdit::query()
                ->where('message_id', $message->getKey())
                ->max('version_no') + 1;

            MessageEdit::query()->create([
                'message_id' => $message->getKey(),
                'version_no' => $nextVersion,
                'old_text' => $message->text_body,
                'new_text' => trim($text),
                'edited_by' => $actorId,
                'edited_at' => now(),
            ]);

            $message->forceFill([
                'text_body' => trim($text),
                'is_edited' => true,
                'edited_at' => now(),
            ])->save();

            if ($message->conversation->last_message_id === $message->getKey()) {
                $message->conversation->forceFill([
                    'last_message_preview' => $this->buildPreview($message),
                    'last_message_at' => $message->created_at,
                ])->save();
            }

            return $message;
        });

        return $this->loadMessage($updatedMessage);
    }

    public function deleteForSelf(Message $message, int $userId): void
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $userId);

        MessageHiddenForUser::query()->firstOrCreate([
            'message_id' => $message->getKey(),
            'user_id' => $userId,
        ], [
            'hidden_at' => now(),
        ]);
    }

    public function unsendForEveryone(Message $message, int $actorId): Message
    {
        $this->conversationMemberService->requireActiveMembership($message->conversation, $actorId);

        if ($message->sender_id !== $actorId) {
            throw new InvalidArgumentException('Only the original sender may unsend this message.');
        }

        if ($message->deleted_for_everyone_at) {
            return $this->loadMessage($message);
        }

        $updatedMessage = DB::transaction(function () use ($actorId, $message): Message {
            $message = Message::query()
                ->whereKey($message->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $message->forceFill([
                'deleted_for_everyone_at' => now(),
                'deleted_for_everyone_by' => $actorId,
            ])->save();

            $conversation = Conversation::query()
                ->whereKey($message->conversation_id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($conversation->last_message_id === $message->getKey()) {
                $conversation->forceFill([
                    'last_message_preview' => $this->buildPreview($message),
                    'last_message_at' => $message->created_at,
                ])->save();
            }

            ConversationMember::query()
                ->where('conversation_id', $conversation->getKey())
                ->where('membership_state', 'active')
                ->where('user_id', '!=', $actorId)
                ->where('last_read_seq', '<', $message->seq)
                ->where('unread_count_cache', '>', 0)
                ->decrement('unread_count_cache');

            return $message;
        });

        return $this->loadMessage($updatedMessage);
    }

    protected function resolveReplyTarget(Conversation $conversation, int $userId, int $replyToMessageId): Message
    {
        $replyTo = Message::query()
            ->whereKey($replyToMessageId)
            ->where('conversation_id', $conversation->getKey())
            ->with('sender')
            ->first();

        if (! $replyTo) {
            throw new InvalidArgumentException('The reply target does not belong to this conversation.');
        }

        $hiddenForUser = $replyTo->hiddenForUsers()
            ->where('user_id', $userId)
            ->exists();

        if ($hiddenForUser) {
            throw new InvalidArgumentException('You cannot reply to a message hidden from your view.');
        }

        return $replyTo;
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildQuoteSnapshot(Message $message): array
    {
        return [
            'message_id' => $message->id,
            'sender_id' => $message->sender_id,
            'sender_name' => $message->sender?->name,
            'type' => $message->type,
            'text_body' => $message->deleted_for_everyone_at ? null : Str::limit((string) $message->text_body, 200),
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    protected function buildPreview(Message $message): string
    {
        if ($message->deleted_for_everyone_at) {
            return 'Message unsent';
        }

        if ($message->type === 'text') {
            return Str::limit((string) $message->text_body, 255);
        }

        return match ($message->type) {
            'voice' => 'Voice message',
            'image' => 'Photo',
            'video' => 'Video',
            'file' => 'File',
            'gif' => 'GIF',
            'call' => 'Call event',
            default => 'New message',
        };
    }

    protected function incrementUnreadCounts(int $conversationId, int $senderId): void
    {
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('membership_state', 'active')
            ->where('user_id', '!=', $senderId)
            ->increment('unread_count_cache');
    }

    protected function syncConversationAfterMessageMutation(Conversation $conversation, Message $message): void
    {
        $conversation->forceFill([
            'last_message_seq' => $message->seq,
            'last_message_id' => $message->getKey(),
            'last_message_preview' => $this->buildPreview($message),
            'last_message_at' => $message->created_at,
        ])->save();
    }

    protected function findExistingMessage(int $conversationId, int $senderId, string $clientUuid): ?Message
    {
        return Message::query()
            ->where('conversation_id', $conversationId)
            ->where('sender_id', $senderId)
            ->where('client_uuid', $clientUuid)
            ->first();
    }

    protected function loadMessage(Message $message): Message
    {
        return $message->fresh([
            'conversation',
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);
    }
}
