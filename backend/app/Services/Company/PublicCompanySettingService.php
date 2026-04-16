<?php

namespace App\Services\Company;

use App\Http\Resources\StorageObjectResource;
use App\Models\CompanySetting;
use App\Models\StorageObject;

class PublicCompanySettingService
{
    public function publicPayload(): array
    {
        $companySetting = $this->activeSetting();

        if (! $companySetting) {
            return [
                'id' => null,
                'company_name' => 'Nexus',
                'company_details' => null,
                'proprietor_name' => null,
                'company_address' => null,
                'factory_address' => null,
                'company_mobile' => null,
                'company_phone' => null,
                'company_email' => null,
                'trade_license' => null,
                'tin_no' => null,
                'bin_no' => null,
                'vat_no' => null,
                'vat_rate' => '0.00',
                'currency' => 'BDT',
                'company_logo' => null,
                'company_logo_object' => null,
                'is_registration_enable' => false,
                'is_email_verification_enable' => true,
                'status' => 'inactive',
                'created_at' => null,
                'updated_at' => null,
            ];
        }

        $companyLogoObject = $companySetting->company_logo
            ? StorageObject::query()->where('object_uuid', $companySetting->company_logo)->first()
            : null;

        return [
            'id' => $companySetting->id,
            'company_name' => $companySetting->company_name,
            'company_details' => $companySetting->company_details,
            'proprietor_name' => $companySetting->proprietor_name,
            'company_address' => $companySetting->company_address,
            'factory_address' => $companySetting->factory_address,
            'company_mobile' => $companySetting->company_mobile,
            'company_phone' => $companySetting->company_phone,
            'company_email' => $companySetting->company_email,
            'trade_license' => $companySetting->trade_license,
            'tin_no' => $companySetting->tin_no,
            'bin_no' => $companySetting->bin_no,
            'vat_no' => $companySetting->vat_no,
            'vat_rate' => (string) $companySetting->vat_rate,
            'currency' => $companySetting->currency,
            'company_logo' => $companySetting->company_logo,
            'company_logo_object' => $companyLogoObject
                ? (new StorageObjectResource($companyLogoObject))->resolve()
                : null,
            'is_registration_enable' => (bool) $companySetting->is_registration_enable,
            'is_email_verification_enable' => (bool) $companySetting->is_email_verification_enable,
            'status' => $companySetting->status,
            'created_at' => $companySetting->created_at?->toIso8601String(),
            'updated_at' => $companySetting->updated_at?->toIso8601String(),
        ];
    }

    public function registrationEnabled(): bool
    {
        return $this->activeSetting()?->is_registration_enable ?? false;
    }

    public function emailVerificationEnabled(): bool
    {
        return $this->activeSetting()?->is_email_verification_enable ?? true;
    }

    public function activeSetting(): ?CompanySetting
    {
        return CompanySetting::query()
            ->where('status', 'active')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->first();
    }
}
