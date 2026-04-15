<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'invoice_id',
    'product_id',
    'product_price_id',
    'product_unit_id',
    'product_name',
    'unit_name',
    'unit_code',
    'unit_value',
    'price',
    'quantity',
    'line_total',
])]
class InvoiceItem extends Model
{
    protected function casts(): array
    {
        return [
            'unit_value' => 'decimal:4',
            'price' => 'decimal:2',
            'quantity' => 'decimal:4',
            'line_total' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productPrice(): BelongsTo
    {
        return $this->belongsTo(ProductPrice::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }
}
