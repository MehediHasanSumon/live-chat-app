<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['username', 'name', 'phone', 'email', 'email_verified_at', 'password_hash', 'avatar_object_id', 'status', 'last_seen_at'])]
#[Hidden(['password_hash', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password_hash' => 'hashed',
            'last_seen_at' => 'datetime',
        ];
    }

    public function avatarObject(): BelongsTo
    {
        return $this->belongsTo(StorageObject::class, 'avatar_object_id');
    }

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(UserDevice::class);
    }

    public function blocksCreated(): HasMany
    {
        return $this->hasMany(UserBlock::class, 'blocker_user_id');
    }

    public function blocksReceived(): HasMany
    {
        return $this->hasMany(UserBlock::class, 'blocked_user_id');
    }

    public function restrictionsCreated(): HasMany
    {
        return $this->hasMany(UserRestriction::class, 'owner_user_id');
    }

    public function restrictionsReceived(): HasMany
    {
        return $this->hasMany(UserRestriction::class, 'target_user_id');
    }

    public function conversationMemberships(): HasMany
    {
        return $this->hasMany(ConversationMember::class);
    }

    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class, 'conversation_members')
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

    public function sentMessages(): HasMany
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function hiddenMessages(): HasMany
    {
        return $this->hasMany(MessageHiddenForUser::class);
    }

    public function ownedStorageObjects(): HasMany
    {
        return $this->hasMany(StorageObject::class, 'owner_user_id');
    }

    public function createdConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'created_by');
    }

    public function createdCallRooms(): HasMany
    {
        return $this->hasMany(CallRoom::class, 'created_by');
    }

    public function callParticipations(): HasMany
    {
        return $this->hasMany(CallRoomParticipant::class);
    }

    public function notificationsOutbox(): HasMany
    {
        return $this->hasMany(NotificationOutbox::class);
    }
}
