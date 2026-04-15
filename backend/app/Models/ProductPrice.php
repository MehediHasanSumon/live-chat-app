<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['product_id', 'product_unit_id', 'original_price', 'sell_price', 'date_time', 'is_active', 'created_by', 'deactivated_at', 'note'])]
class ProductPrice extends Model
{
    protected function casts(): array
    {
        return [
            'original_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'date_time' => 'datetime',
            'is_active' => 'boolean',
            'deactivated_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
