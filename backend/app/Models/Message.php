<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'quote_snapshot_json' => 'array',
            'metadata_json' => 'array',
            'is_edited' => 'boolean',
            'edited_at' => 'datetime',
            'editable_until_at' => 'datetime',
            'deleted_for_everyone_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }

    public function forwardedFromMessage(): BelongsTo
    {
        return $this->belongsTo(self::class, 'forwarded_from_message_id');
    }

    public function forwardedFromConversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'forwarded_from_conversation_id');
    }

    public function forwardedFromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'forwarded_from_user_id');
    }

    public function deletedForEveryoneBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_for_everyone_by');
    }

    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function hiddenForUsers(): HasMany
    {
        return $this->hasMany(MessageHiddenForUser::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
