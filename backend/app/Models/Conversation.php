<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Conversation extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
            'last_message_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function avatarObject(): BelongsTo
    {
        return $this->belongsTo(StorageObject::class, 'avatar_object_id');
    }

    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ConversationMember::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'conversation_members')
            ->withPivot([
                'role',
                'membership_state',
                'last_read_seq',
                'last_delivered_seq',
                'unread_count_cache',
                'archived_at',
                'pinned_at',
                'muted_until',
                'notifications_mode',
                'notification_schedule_json',
            ]);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function activeCallRoom(): HasOne
    {
        return $this->hasOne(CallRoom::class, 'room_uuid', 'active_room_uuid');
    }
}
