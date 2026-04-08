<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $actorId = $request->user()?->getKey();
        $displayText = $this->deleted_for_everyone_at
            ? 'Message unsent'
            : match ($this->type) {
                'voice' => 'Voice message',
                'image' => $this->text_body ?: 'Shared photo',
                'video' => $this->text_body ?: 'Shared video',
                'file' => $this->text_body ?: 'Shared attachment',
                'gif' => $this->text_body ?: 'GIF',
                default => $this->text_body,
            };

        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'seq' => $this->seq,
            'sender_id' => $this->sender_id,
            'client_uuid' => $this->client_uuid,
            'type' => $this->type,
            'sub_type' => $this->sub_type,
            'text_body' => $this->deleted_for_everyone_at ? null : $this->text_body,
            'display_text' => $displayText,
            'reply_to_message_id' => $this->reply_to_message_id,
            'quote_snapshot_json' => $this->quote_snapshot_json,
            'forwarded_from_message_id' => $this->forwarded_from_message_id,
            'forwarded_from_conversation_id' => $this->forwarded_from_conversation_id,
            'forwarded_from_user_id' => $this->forwarded_from_user_id,
            'metadata_json' => $this->metadata_json,
            'is_edited' => $this->is_edited,
            'edited_at' => $this->edited_at,
            'editable_until_at' => $this->editable_until_at,
            'deleted_for_everyone_at' => $this->deleted_for_everyone_at,
            'deleted_for_everyone_by' => $this->deleted_for_everyone_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'can_edit' => $actorId !== null
                ? $this->sender_id === $actorId
                    && $this->deleted_for_everyone_at === null
                    && $this->editable_until_at !== null
                    && $this->editable_until_at->isFuture()
                : false,
            'can_unsend' => $actorId !== null
                ? $this->sender_id === $actorId && $this->deleted_for_everyone_at === null
                : false,
            'sender' => $this->whenLoaded('sender', fn () => (new UserResource($this->sender))->resolve($request)),
            'reply_to' => $this->whenLoaded('replyTo', function () use ($request) {
                if (! $this->replyTo) {
                    return null;
                }

                return [
                    'id' => $this->replyTo->id,
                    'sender_id' => $this->replyTo->sender_id,
                    'type' => $this->replyTo->type,
                    'text_body' => $this->replyTo->deleted_for_everyone_at ? null : $this->replyTo->text_body,
                    'created_at' => $this->replyTo->created_at,
                    'sender' => $this->replyTo->relationLoaded('sender') && $this->replyTo->sender
                        ? (new UserResource($this->replyTo->sender))->resolve($request)
                        : null,
                ];
            }),
            'reactions' => $this->whenLoaded('reactions', fn () => MessageReactionResource::collection($this->reactions)->resolve()),
            'attachments' => $this->whenLoaded('attachments', fn () => MessageAttachmentResource::collection($this->attachments)->resolve()),
        ];
    }
}
