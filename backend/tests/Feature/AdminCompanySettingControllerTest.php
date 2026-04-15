<?php

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function companySettingPayload(array $overrides = []): array
{
    return [
        'company_name' => 'Nexus Fuel Station',
        'company_details' => 'Retail fuel and lubricant sales.',
        'proprietor_name' => 'Rahim Uddin',
        'company_address' => 'Dhaka, Bangladesh',
        'factory_address' => 'Gazipur, Bangladesh',
        'company_mobile' => '+8801700000000',
        'company_phone' => '02-123456',
        'company_email' => 'office@example.com',
        'trade_license' => 'TL-1001',
        'tin_no' => 'TIN-1001',
        'bin_no' => 'BIN-1001',
        'vat_no' => 'VAT-1001',
        'vat_rate' => 7.5,
        'currency' => 'BDT',
        'company_logo' => 'https://example.com/logo.png',
        'is_registration_enable' => true,
        'is_email_verification_enable' => false,
        'status' => 'active',
        ...$overrides,
    ];
}

it('creates a company setting', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/admin/company-settings', companySettingPayload());

    $response
        ->assertCreated()
        ->assertJsonPath('data.company_name', 'Nexus Fuel Station')
        ->assertJsonPath('data.company_email', 'office@example.com')
        ->assertJsonPath('data.vat_rate', '7.50')
        ->assertJsonPath('data.currency', 'BDT')
        ->assertJsonPath('data.is_registration_enable', true)
        ->assertJsonPath('data.status', 'active');

    expect(CompanySetting::query()->where('company_name', 'Nexus Fuel Station')->exists())->toBeTrue();
});

it('returns paginated company settings with search', function () {
    $user = User::factory()->create();
    CompanySetting::query()->create(companySettingPayload(['company_name' => 'Alpha Station', 'company_email' => 'alpha@example.com']));
    CompanySetting::query()->create(companySettingPayload(['company_name' => 'Beta Station', 'company_email' => 'beta@example.com']));

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/company-settings?search=beta&per_page=10');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.company_name', 'Beta Station')
        ->assertJsonPath('meta.total', 1);
});

it('updates a company setting', function () {
    $user = User::factory()->create();
    $companySetting = CompanySetting::query()->create(companySettingPayload());

    $response = $this->actingAs($user, 'web')
        ->patchJson("/api/admin/company-settings/{$companySetting->id}", companySettingPayload([
            'company_name' => 'Nexus Energy',
            'vat_rate' => 15,
            'is_email_verification_enable' => true,
            'status' => 'inactive',
        ]));

    $response
        ->assertOk()
        ->assertJsonPath('data.company_name', 'Nexus Energy')
        ->assertJsonPath('data.vat_rate', '15.00')
        ->assertJsonPath('data.is_email_verification_enable', true)
        ->assertJsonPath('data.status', 'inactive');

    expect($companySetting->fresh()->company_name)->toBe('Nexus Energy');
});

it('shows a company setting', function () {
    $user = User::factory()->create();
    $companySetting = CompanySetting::query()->create(companySettingPayload([
        'company_name' => 'Nexus Details',
    ]));

    $response = $this->actingAs($user, 'web')
        ->getJson("/api/admin/company-settings/{$companySetting->id}");

    $response
        ->assertOk()
        ->assertJsonPath('data.id', $companySetting->id)
        ->assertJsonPath('data.company_name', 'Nexus Details');
});

it('deletes a company setting', function () {
    $user = User::factory()->create();
    $companySetting = CompanySetting::query()->create(companySettingPayload());

    $this->actingAs($user, 'web')
        ->deleteJson("/api/admin/company-settings/{$companySetting->id}")
        ->assertNoContent();

    expect(CompanySetting::query()->whereKey($companySetting->id)->exists())->toBeFalse();
});

it('validates company setting payloads', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/admin/company-settings', companySettingPayload([
            'company_name' => '',
            'company_email' => 'invalid-email',
            'vat_rate' => 150,
            'status' => 'archived',
        ]));

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['company_name', 'company_email', 'vat_rate', 'status']);
});
