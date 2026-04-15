<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'invoice_no',
    'invoice_datetime',
    'customer_id',
    'payment_type',
    'payment_status',
    'subtotal_amount',
    'discount_amount',
    'total_amount',
    'paid_amount',
    'due_amount',
    'sms_enabled',
    'status',
    'created_by',
    'updated_by',
])]
class Invoice extends Model
{
    protected function casts(): array
    {
        return [
            'invoice_datetime' => 'datetime',
            'subtotal_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_amount' => 'decimal:2',
            'sms_enabled' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function smsLogs(): HasMany
    {
        return $this->hasMany(InvoiceSmsLog::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
