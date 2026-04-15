<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSetting extends Model
{
    use HasFactory;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'show_active_status' => 'boolean',
            'allow_message_requests' => 'boolean',
            'push_enabled' => 'boolean',
            'sound_enabled' => 'boolean',
            'vibrate_enabled' => 'boolean',
            'quiet_hours_enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
