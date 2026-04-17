<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['url', 'api_key', 'sender_id', 'status'])]
#[Hidden(['api_key'])]
class SmsServiceCredential extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected static function booted(): void
    {
        static::saving(function (SmsServiceCredential $credential): void {
            if (! in_array($credential->status, [self::STATUS_ACTIVE, self::STATUS_INACTIVE], true)) {
                $credential->status = self::STATUS_INACTIVE;
            }
        });

        static::saved(function (SmsServiceCredential $credential): void {
            if ($credential->status !== self::STATUS_ACTIVE) {
                return;
            }

            static::query()
                ->whereKeyNot($credential->getKey())
                ->where('status', self::STATUS_ACTIVE)
                ->update([
                    'status' => self::STATUS_INACTIVE,
                    'updated_at' => now(),
                ]);
        });
    }

    public function invoiceSmsLogs(): HasMany
    {
        return $this->hasMany(InvoiceSmsLog::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
