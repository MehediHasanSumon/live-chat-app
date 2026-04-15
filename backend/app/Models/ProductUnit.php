<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['unit_name', 'unit_value', 'unit_code'])]
class ProductUnit extends Model
{
    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
