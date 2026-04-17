<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'invoice_id',
    'customer_id',
    'sms_service_credential_id',
    'invoice_sms_template_id',
    'recipient_name',
    'mobile',
    'sender_id',
    'message',
    'status',
    'provider_response',
    'sent_at',
])]
class InvoiceSmsLog extends Model
{
    protected function casts(): array
    {
        return [
            'provider_response' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function credential(): BelongsTo
    {
        return $this->belongsTo(SmsServiceCredential::class, 'sms_service_credential_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(InvoiceSmsTemplate::class, 'invoice_sms_template_id');
    }
}
