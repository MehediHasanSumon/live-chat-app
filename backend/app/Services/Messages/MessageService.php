<?php

namespace App\Services\Messages;

use App\Models\CallRoom;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageEdit;
use App\Models\MessageHiddenForUser;
use App\Models\StorageObject;
use App\Services\Conversations\ConversationMemberService;
use App\Services\Privacy\PrivacyService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class MessageService
{
    public function __construct(
        protected ConversationMemberService $conversationMemberService,
        protected PrivacyService $privacyService,
    ) {
    }

    public function listForUser(Conversation $conversation, int $userId, ?int $cursor = null, int $limit = 50): Collection
    {
        $this->conversationMemberService->requireReadableMembership($conversation, $userId);

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
                'sender.avatarObject',
                'replyTo.sender.avatarObject',
                'reactions.user.avatarObject',
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
        $this->privacyService->ensureChatAllowed($senderId, $conversation);

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
     * @param  array<int, float|int>|null  $waveform
     * @return array{message: Message, created: bool}
     */
    public function sendVoice(
        Conversation $conversation,
        int $senderId,
        int $storageObjectId,
        int $durationMs,
        ?array $waveform = null,
        ?string $clientUuid = null,
    ): array {
        $this->conversationMemberService->requireActiveMembership($conversation, $senderId);
        $this->privacyService->ensureChatAllowed($senderId, $conversation);

        if ($clientUuid) {
            $existing = $this->findExistingMessage($conversation->id, $senderId, $clientUuid);

            if ($existing) {
                return [
                    'message' => $this->loadMessage($existing),
                    'created' => false,
                ];
            }
        }

        $message = DB::transaction(function () use ($clientUuid, $conversation, $durationMs, $senderId, $storageObjectId, $waveform): Message {
            $storageObject = $this->lockOwnedStorageObject($storageObjectId, $senderId);

            if (! in_array($storageObject->media_kind, ['audio', 'voice'], true)) {
                throw new InvalidArgumentException('Only audio uploads can be sent as a voice message.');
            }

            return $this->createMessageWithAttachments(
                $conversation,
                $senderId,
                [
                    'client_uuid' => $clientUuid,
                    'type' => 'voice',
                    'metadata_json' => [
                        'duration_ms' => $durationMs,
                        'waveform' => $waveform ?? [],
                    ],
                    'editable_until_at' => now()->addMinutes(15),
                ],
                [$storageObject],
            );
        });

        return [
            'message' => $this->loadMessage($message),
            'created' => true,
        ];
    }

    /**
     * @param  array<int, int>  $storageObjectIds
     * @return array{message: Message, created: bool}
     */
    public function sendMedia(
        Conversation $conversation,
        int $senderId,
        array $storageObjectIds,
        ?string $caption = null,
        ?string $clientUuid = null,
    ): array {
        $this->conversationMemberService->requireActiveMembership($conversation, $senderId);
        $this->privacyService->ensureChatAllowed($senderId, $conversation);

        if ($clientUuid) {
            $existing = $this->findExistingMessage($conversation->id, $senderId, $clientUuid);

            if ($existing) {
                return [
                    'message' => $this->loadMessage($existing),
                    'created' => false,
                ];
            }
        }

        $message = DB::transaction(function () use ($caption, $clientUuid, $conversation, $senderId, $storageObjectIds): Message {
            $storageObjects = collect($storageObjectIds)
                ->map(fn ($storageObjectId) => $this->lockOwnedStorageObject((int) $storageObjectId, $senderId));

            $kinds = $storageObjects->pluck('media_kind')->unique()->values()->all();
            $type = in_array('image', $kinds, true) && count($kinds) === 1
                ? 'image'
                : (in_array('video', $kinds, true) && count($kinds) === 1 ? 'video' : 'file');

            return $this->createMessageWithAttachments(
                $conversation,
                $senderId,
                [
                    'client_uuid' => $clientUuid,
                    'type' => $type,
                    'text_body' => $caption ? trim($caption) : null,
                    'editable_until_at' => now()->addMinutes(15),
                ],
                $storageObjects->all(),
            );
        });

        return [
            'message' => $this->loadMessage($message),
            'created' => true,
        ];
    }

    /**
     * @param  array<string, mixed>  $gifMeta
     * @return array{message: Message, created: bool}
     */
    public function sendGif(
        Conversation $conversation,
        int $senderId,
        array $gifMeta,
        ?string $clientUuid = null,
    ): array {
        $this->conversationMemberService->requireActiveMembership($conversation, $senderId);
        $this->privacyService->ensureChatAllowed($senderId, $conversation);

        if ($clientUuid) {
            $existing = $this->findExistingMessage($conversation->id, $senderId, $clientUuid);

            if ($existing) {
                return [
                    'message' => $this->loadMessage($existing),
                    'created' => false,
                ];
            }
        }

        $message = DB::transaction(function () use ($clientUuid, $conversation, $gifMeta, $senderId): Message {
            return $this->createMessageWithAttachments(
                $conversation,
                $senderId,
                [
                    'client_uuid' => $clientUuid,
                    'type' => 'gif',
                    'metadata_json' => $gifMeta,
                    'text_body' => $gifMeta['title'] ?? 'GIF',
                    'editable_until_at' => now()->addMinutes(15),
                ],
                [],
            );
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
        $this->privacyService->ensureChatAllowed($actorId, $targetConversation);

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
        $this->privacyService->ensureChatAllowed($actorId, $message->conversation);

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

    /**
     * @return array{message: Message, created: bool}
     */
    public function syncCallEvent(CallRoom $callRoom, string $action, ?int $actorId = null): array
    {
        $message = DB::transaction(function () use ($action, $actorId, $callRoom): array {
            $lockedConversation = Conversation::query()
                ->whereKey($callRoom->conversation_id)
                ->lockForUpdate()
                ->firstOrFail();

            $message = Message::query()
                ->where('call_room_uuid', $callRoom->room_uuid)
                ->lockForUpdate()
                ->first();

            $textBody = $this->buildCallHistoryText($callRoom, $action);
            $metadata = $this->buildCallHistoryMetadata($callRoom, $action);
            $created = false;

            if (! $message) {
                $nextSeq = (int) $lockedConversation->last_message_seq + 1;

                $message = Message::query()->create([
                    'conversation_id' => $lockedConversation->getKey(),
                    'seq' => $nextSeq,
                    'sender_id' => $actorId ?? $callRoom->created_by,
                    'client_uuid' => null,
                    'call_room_uuid' => $callRoom->room_uuid,
                    'type' => 'call',
                    'sub_type' => $action,
                    'text_body' => $textBody,
                    'metadata_json' => $metadata,
                    'editable_until_at' => null,
                ]);

                $this->syncConversationAfterMessageMutation($lockedConversation, $message);
                $this->incrementUnreadCounts($lockedConversation->id, $message->sender_id);
                $created = true;
            } else {
                $message->forceFill([
                    'sender_id' => $message->sender_id ?: ($actorId ?? $callRoom->created_by),
                    'sub_type' => $action,
                    'text_body' => $textBody,
                    'metadata_json' => $metadata,
                ])->save();

                if ($lockedConversation->last_message_id === $message->getKey()) {
                    $lockedConversation->forceFill([
                        'last_message_preview' => $this->buildPreview($message),
                        'last_message_at' => $message->created_at,
                    ])->save();
                }
            }

            return [
                'message' => $message,
                'created' => $created,
            ];
        });

        return [
            'message' => $this->loadMessage($message['message']),
            'created' => $message['created'],
        ];
    }

    protected function resolveReplyTarget(Conversation $conversation, int $userId, int $replyToMessageId): Message
    {
        $replyTo = Message::query()
            ->whereKey($replyToMessageId)
            ->where('conversation_id', $conversation->getKey())
            ->with('sender.avatarObject')
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

        if (in_array($message->type, ['text', 'gif'], true) && $message->text_body) {
            return Str::limit((string) $message->text_body, 255);
        }

        return match ($message->type) {
            'voice' => 'Voice message',
            'image' => 'Photo',
            'video' => 'Video',
            'file' => 'File',
            'gif' => 'GIF',
            'call' => $message->text_body ?: 'Call event',
            default => 'New message',
        };
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildCallHistoryMetadata(CallRoom $callRoom, string $action): array
    {
        $participants = $callRoom->relationLoaded('participants')
            ? $callRoom->participants
            : $callRoom->participants()->with('user')->get();
        $acceptedParticipants = $participants
            ->filter(fn ($participant) => $participant->joined_at !== null || $participant->invite_status === 'accepted')
            ->pluck('user.name')
            ->filter()
            ->values();
        $declinedParticipants = $participants
            ->where('invite_status', 'declined')
            ->pluck('user.name')
            ->filter()
            ->values();
        $missedParticipants = $participants
            ->where('invite_status', 'missed')
            ->pluck('user.name')
            ->filter()
            ->values();
        $ringDurationSeconds = 0;
        $ringEndAt = $callRoom->started_at ?? $callRoom->ended_at;

        if ($callRoom->created_at && $ringEndAt) {
            $ringDurationSeconds = max((int) $callRoom->created_at->diffInSeconds($ringEndAt), 0);
        }

        return [
            'action' => $action,
            'status' => $callRoom->status,
            'room_uuid' => $callRoom->room_uuid,
            'media_type' => $callRoom->media_type,
            'started_at' => $callRoom->started_at?->toIso8601String(),
            'ended_at' => $callRoom->ended_at?->toIso8601String(),
            'ended_reason' => $callRoom->ended_reason,
            'duration_seconds' => (int) ($callRoom->duration_seconds ?? 0),
            'ring_duration_seconds' => $ringDurationSeconds,
            'accepted_by' => $acceptedParticipants->all(),
            'declined_by' => $declinedParticipants->all(),
            'missed_by' => $missedParticipants->all(),
        ];
    }

    protected function buildCallHistoryText(CallRoom $callRoom, string $action): string
    {
        $callLabel = $callRoom->media_type === 'video' ? 'Video call' : 'Voice call';
        $duration = $this->formatDurationLabel((int) ($callRoom->duration_seconds ?? 0));

        return match ($action) {
            'calling' => "{$callLabel} started",
            'ringing' => "{$callLabel} ringing",
            'connecting' => "{$callLabel} accepted",
            'in_call' => $duration ? "{$callLabel} in call · {$duration}" : "{$callLabel} in call",
            'declined' => "{$callLabel} declined",
            'missed' => "{$callLabel} missed",
            'cancelled' => "{$callLabel} cancelled",
            'failed' => "{$callLabel} failed",
            'ended' => $duration ? "{$callLabel} ended · {$duration}" : "{$callLabel} ended",
            default => $callLabel,
        };
    }

    protected function formatDurationLabel(int $totalSeconds): ?string
    {
        if ($totalSeconds <= 0) {
            return null;
        }

        $safeSeconds = max(0, $totalSeconds);
        $hours = intdiv($safeSeconds, 3600);
        $minutes = intdiv($safeSeconds % 3600, 60);
        $seconds = $safeSeconds % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
        }

        return sprintf('%02d:%02d', $minutes, $seconds);
    }

    protected function incrementUnreadCounts(int $conversationId, int $senderId): void
    {
        ConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('membership_state', 'active')
            ->where('user_id', '!=', $senderId)
            ->update([
                'unread_count_cache' => DB::raw('unread_count_cache + 1'),
                'archived_at' => null,
            ]);
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
            'sender.avatarObject',
            'replyTo.sender.avatarObject',
            'reactions.user.avatarObject',
            'attachments.storageObject',
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, StorageObject>  $storageObjects
     */
    protected function createMessageWithAttachments(
        Conversation $conversation,
        int $senderId,
        array $attributes,
        array $storageObjects,
    ): Message {
        $lockedConversation = Conversation::query()
            ->whereKey($conversation->getKey())
            ->lockForUpdate()
            ->firstOrFail();

        $nextSeq = (int) $lockedConversation->last_message_seq + 1;

        $message = Message::query()->create([
            'conversation_id' => $lockedConversation->getKey(),
            'seq' => $nextSeq,
            'sender_id' => $senderId,
            'client_uuid' => $attributes['client_uuid'] ?? null,
            'type' => $attributes['type'],
            'sub_type' => $attributes['sub_type'] ?? null,
            'text_body' => $attributes['text_body'] ?? null,
            'reply_to_message_id' => $attributes['reply_to_message_id'] ?? null,
            'quote_snapshot_json' => $attributes['quote_snapshot_json'] ?? null,
            'forwarded_from_message_id' => $attributes['forwarded_from_message_id'] ?? null,
            'forwarded_from_conversation_id' => $attributes['forwarded_from_conversation_id'] ?? null,
            'forwarded_from_user_id' => $attributes['forwarded_from_user_id'] ?? null,
            'metadata_json' => $attributes['metadata_json'] ?? null,
            'editable_until_at' => $attributes['editable_until_at'] ?? now()->addMinutes(15),
        ]);

        foreach ($storageObjects as $index => $storageObject) {
            MessageAttachment::query()->create([
                'message_id' => $message->getKey(),
                'conversation_id' => $lockedConversation->getKey(),
                'storage_object_id' => $storageObject->getKey(),
                'uploader_user_id' => $senderId,
                'display_order' => $index + 1,
                'created_at' => now(),
            ]);

            $storageObject->forceFill([
                'ref_count' => (int) $storageObject->ref_count + 1,
                'first_attached_at' => $storageObject->first_attached_at ?? now(),
                'last_attached_at' => now(),
            ])->save();
        }

        $this->syncConversationAfterMessageMutation($lockedConversation, $message);
        $this->incrementUnreadCounts($lockedConversation->id, $senderId);

        return $message;
    }

    protected function lockOwnedStorageObject(int $storageObjectId, int $ownerUserId): StorageObject
    {
        $storageObject = StorageObject::query()
            ->whereKey($storageObjectId)
            ->lockForUpdate()
            ->firstOrFail();

        if ((int) $storageObject->owner_user_id !== $ownerUserId) {
            throw new InvalidArgumentException('You may only send files that you uploaded.');
        }

        if ($storageObject->purpose !== 'message_attachment') {
            throw new InvalidArgumentException('Only message attachments can be sent in messages.');
        }

        if ($storageObject->deleted_at !== null) {
            throw new InvalidArgumentException('One or more selected files are no longer available.');
        }

        return $storageObject;
    }
}
