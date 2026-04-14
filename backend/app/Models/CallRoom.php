<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CallRoom extends Model
{
    use HasFactory;

    public const ACTIVE_STATUSES = ['calling', 'ringing', 'connecting', 'active'];

    public const TERMINAL_STATUSES = ['ended', 'missed', 'declined', 'cancelled', 'failed'];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_locked' => 'boolean',
            'duration_seconds' => 'integer',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_webhook_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(CallRoomParticipant::class);
    }

    public function getRouteKeyName(): string
    {
        return 'room_uuid';
    }
}
