<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['product_name', 'product_code', 'description', 'status'])]
class Product extends Model
{
    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function activePrice(): HasOne
    {
        return $this->hasOne(ProductPrice::class)->where('is_active', true);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
