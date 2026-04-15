<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'company_name',
    'company_details',
    'proprietor_name',
    'company_address',
    'factory_address',
    'company_mobile',
    'company_phone',
    'company_email',
    'trade_license',
    'tin_no',
    'bin_no',
    'vat_no',
    'vat_rate',
    'currency',
    'company_logo',
    'is_registration_enable',
    'is_email_verification_enable',
    'status',
])]
class CompanySetting extends Model
{
    protected $casts = [
        'vat_rate' => 'decimal:2',
        'is_registration_enable' => 'boolean',
        'is_email_verification_enable' => 'boolean',
    ];
}
