<?php

use App\Models\InvoiceSmsLog;
use App\Models\InvoiceSmsTemplate;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductUnit;
use App\Models\SmsServiceCredential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

function createSmsInvoiceProductSet(): array
{
    $product = Product::query()->create([
        'product_name' => 'Octane',
        'product_code' => 'OCTANE',
        'status' => 'active',
    ]);
    $unit = ProductUnit::query()->create([
        'unit_name' => 'Liter',
        'unit_value' => 'liter',
        'unit_code' => 'PU001',
    ]);
    $price = ProductPrice::query()->create([
        'product_id' => $product->id,
        'product_unit_id' => $unit->id,
        'original_price' => 50,
        'sell_price' => 60,
        'date_time' => '2026-05-04 10:00:00',
        'is_active' => true,
    ]);

    return [$product, $price];
}

it('manages sms service credentials through admin api and keeps one active', function () {
    $actor = User::factory()->create();

    $firstId = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/sms/credentials', [
            'url' => 'https://sms.example.com/send',
            'api_key' => 'first-secret',
            'sender_id' => 'SHOP',
            'status' => 'active',
        ])
        ->assertCreated()
        ->assertJsonPath('data.sender_id', 'SHOP')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.api_key_present', true)
        ->assertJsonMissing(['api_key' => 'first-secret'])
        ->json('data.id');

    $secondId = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/sms/credentials', [
            'url' => 'https://sms2.example.com/send',
            'api_key' => 'second-secret',
            'sender_id' => 'SHOP2',
            'status' => 'active',
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($actor, 'web')
        ->getJson('/api/admin/sms/credentials/active')
        ->assertOk()
        ->assertJsonPath('data.id', $secondId);

    expect(SmsServiceCredential::query()->findOrFail($firstId)->status)->toBe('inactive')
        ->and(SmsServiceCredential::query()->findOrFail($secondId)->status)->toBe('active');

    $this->actingAs($actor, 'web')
        ->patchJson("/api/admin/sms/credentials/{$firstId}", [
            'url' => 'https://sms.example.com/send',
            'sender_id' => 'SHOP',
            'status' => 'active',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'active');

    expect(SmsServiceCredential::query()->findOrFail($firstId)->status)->toBe('active')
        ->and(SmsServiceCredential::query()->findOrFail($secondId)->status)->toBe('inactive');
});

it('manages invoice sms templates and exposes variable options', function () {
    $actor = User::factory()->create();

    $templateId = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoice-sms-templates', [
            'name' => 'Invoice confirmation',
            'body' => 'Dear {customer_name}, invoice {invoice_no} total {total_amount}',
            'variables_json' => ['customer_name', 'invoice_no', 'total_amount'],
            'status' => 'active',
            'is_default' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Invoice confirmation')
        ->assertJsonPath('data.is_default', true)
        ->json('data.id');

    $this->actingAs($actor, 'web')
        ->getJson('/api/admin/invoice-sms-templates/variables')
        ->assertOk()
        ->assertJsonFragment(['key' => 'invoice_no', 'token' => '{invoice_no}']);

    $this->actingAs($actor, 'web')
        ->patchJson("/api/admin/invoice-sms-templates/{$templateId}", [
            'name' => 'Invoice paid',
            'body' => 'Paid {paid_amount}',
            'variables_json' => ['paid_amount'],
            'status' => 'active',
            'is_default' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Invoice paid');

    expect(InvoiceSmsTemplate::query()->findOrFail($templateId)->updated_by)->toBe($actor->id);
});

it('sends and logs invoice sms when sms is enabled on invoice creation', function () {
    Http::fake([
        'sms.example.com/*' => Http::response(['message_id' => 'sms-123'], 200),
    ]);

    $actor = User::factory()->create();
    [, $price] = createSmsInvoiceProductSet();

    $credential = SmsServiceCredential::query()->create([
        'url' => 'https://sms.example.com/send',
        'api_key' => 'secret-key',
        'sender_id' => 'SHOP',
        'status' => 'active',
    ]);
    $template = InvoiceSmsTemplate::query()->create([
        'name' => 'Invoice confirmation',
        'body' => 'Dear {customer_name}, invoice {invoice_no} total {total_amount}',
        'variables_json' => ['customer_name', 'invoice_no', 'total_amount'],
        'status' => 'active',
        'is_default' => true,
    ]);

    $invoiceId = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoices', [
            'invoice_datetime' => '2026-05-04 11:00:00',
            'customer' => [
                'name' => 'Rahim Uddin',
                'mobile' => '+8801700000011',
                'vehicle_no' => 'DHAKA-123',
            ],
            'payment_type' => 'cash',
            'discount_amount' => 10,
            'sms_enabled' => true,
            'status' => 'submitted',
            'items' => [
                [
                    'product_id' => $price->product_id,
                    'product_price_id' => $price->id,
                    'quantity' => 2,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.sms_logs.0.status', 'sent')
        ->json('data.id');

    Http::assertSent(function ($request): bool {
        return $request->url() === 'https://sms.example.com/send'
            && $request['api_key'] === 'secret-key'
            && $request['sender_id'] === 'SHOP'
            && $request['to'] === '+8801700000011'
            && str_contains($request['message'], 'Rahim Uddin')
            && str_contains($request['message'], '110.00');
    });

    $log = InvoiceSmsLog::query()->firstOrFail();

    expect($log->invoice_id)->toBe($invoiceId)
        ->and($log->sms_service_credential_id)->toBe($credential->id)
        ->and($log->invoice_sms_template_id)->toBe($template->id)
        ->and($log->sender_id)->toBe('SHOP')
        ->and($log->status)->toBe('sent')
        ->and($log->sent_at)->not->toBeNull();

    $this->actingAs($actor, 'web')
        ->getJson('/api/admin/invoice-sms-logs?search=Rahim')
        ->assertOk()
        ->assertJsonPath('data.0.id', $log->id)
        ->assertJsonPath('data.0.status', 'sent');
});
