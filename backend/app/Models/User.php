<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['username', 'name', 'phone', 'email', 'password_hash', 'avatar_object_id', 'status', 'is_system_admin', 'last_seen_at'])]
#[Hidden(['password_hash', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

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
            'is_system_admin' => 'boolean',
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
