<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'mobile', 'vehicle_no'])]
class Customer extends Model
{
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
