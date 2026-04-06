<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StorageObject extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'waveform_json' => 'array',
            'first_attached_at' => 'datetime',
            'last_attached_at' => 'datetime',
            'delete_eligible_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function messageAttachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }

    public function avatarUsers(): HasMany
    {
        return $this->hasMany(User::class, 'avatar_object_id');
    }

    public function avatarConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'avatar_object_id');
    }
}
