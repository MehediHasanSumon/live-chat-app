<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'body', 'variables_json', 'status', 'is_default', 'created_by', 'updated_by'])]
class InvoiceSmsTemplate extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const VARIABLES = [
        'invoice_no',
        'invoice_date',
        'invoice_datetime',
        'customer_name',
        'customer_mobile',
        'vehicle_no',
        'payment_type',
        'payment_status',
        'subtotal_amount',
        'discount_amount',
        'total_amount',
        'paid_amount',
        'due_amount',
        'items',
    ];

    protected static function booted(): void
    {
        static::saving(function (InvoiceSmsTemplate $template): void {
            if (! in_array($template->status, [self::STATUS_ACTIVE, self::STATUS_INACTIVE], true)) {
                $template->status = self::STATUS_INACTIVE;
            }
        });

        static::saved(function (InvoiceSmsTemplate $template): void {
            if (! $template->is_default || $template->status !== self::STATUS_ACTIVE) {
                return;
            }

            static::query()
                ->whereKeyNot($template->getKey())
                ->where('is_default', true)
                ->update([
                    'is_default' => false,
                    'updated_at' => now(),
                ]);
        });
    }

    protected function casts(): array
    {
        return [
            'variables_json' => 'array',
            'is_default' => 'boolean',
        ];
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

    /**
     * @return array<string, string>
     */
    public function variablesForInvoice(Invoice $invoice): array
    {
        $invoice->loadMissing(['customer', 'items']);

        return [
            'invoice_no' => (string) $invoice->invoice_no,
            'invoice_date' => $invoice->invoice_datetime?->toDateString() ?? '',
            'invoice_datetime' => $invoice->invoice_datetime?->format('Y-m-d H:i:s') ?? '',
            'customer_name' => (string) ($invoice->customer?->name ?? ''),
            'customer_mobile' => (string) ($invoice->customer?->mobile ?? ''),
            'vehicle_no' => (string) ($invoice->customer?->vehicle_no ?? ''),
            'payment_type' => (string) $invoice->payment_type,
            'payment_status' => (string) $invoice->payment_status,
            'subtotal_amount' => $this->formatMoney($invoice->subtotal_amount),
            'discount_amount' => $this->formatMoney($invoice->discount_amount),
            'total_amount' => $this->formatMoney($invoice->total_amount),
            'paid_amount' => $this->formatMoney($invoice->paid_amount),
            'due_amount' => $this->formatMoney($invoice->due_amount),
            'items' => $invoice->items
                ->map(function ($item): string {
                    $unit = trim((string) ($item->unit_code ?: $item->unit_name));

                    return trim(sprintf(
                        '%s %s%s x %s',
                        $item->product_name,
                        $this->formatQuantity($item->quantity),
                        $unit !== '' ? " {$unit}" : '',
                        $this->formatMoney($item->price),
                    ));
                })
                ->implode(', '),
        ];
    }

    public function renderForInvoice(Invoice $invoice): string
    {
        $replacements = [];

        foreach ($this->variablesForInvoice($invoice) as $key => $value) {
            $replacements['{'.$key.'}'] = $value;
            $replacements['{{'.$key.'}}'] = $value;
            $replacements['{{ '.$key.' }}'] = $value;
        }

        return strtr($this->body, $replacements);
    }

    protected function formatMoney($value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    protected function formatQuantity($value): string
    {
        return number_format((float) ($value ?? 0), 4, '.', '');
    }
}
