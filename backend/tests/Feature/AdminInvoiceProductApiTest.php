<?php

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('keeps only one active price per product', function () {
    $actor = User::factory()->create();
    $product = Product::query()->create([
        'product_name' => 'Petrol',
        'product_code' => 'PETROL',
        'status' => 'active',
    ]);
    $unit = ProductUnit::query()->create([
        'unit_name' => 'Liter',
        'unit_value' => 1,
        'unit_code' => 'L',
    ]);

    $first = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/product-prices', [
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'original_price' => 50,
            'sell_price' => 55,
            'date_time' => '2026-05-04 10:00:00',
            'is_active' => true,
        ])
        ->assertCreated()
        ->json('data.id');

    $second = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/product-prices', [
            'product_id' => $product->id,
            'product_unit_id' => $unit->id,
            'original_price' => 60,
            'sell_price' => 65,
            'date_time' => '2026-05-06 10:00:00',
            'is_active' => true,
        ])
        ->assertCreated()
        ->json('data.id');

    expect(ProductPrice::query()->findOrFail($first)->is_active)->toBeFalse()
        ->and(ProductPrice::query()->findOrFail($second)->is_active)->toBeTrue()
        ->and(ProductPrice::query()->where('product_id', $product->id)->where('is_active', true)->count())->toBe(1);
});

it('creates an invoice with a new customer and calculated totals', function () {
    $actor = User::factory()->create();
    $product = Product::query()->create([
        'product_name' => 'Octane',
        'product_code' => 'OCTANE',
        'status' => 'active',
    ]);
    $unit = ProductUnit::query()->create([
        'unit_name' => 'Liter',
        'unit_value' => 1,
        'unit_code' => 'L',
    ]);
    $price = ProductPrice::query()->create([
        'product_id' => $product->id,
        'product_unit_id' => $unit->id,
        'original_price' => 50,
        'sell_price' => 60,
        'date_time' => '2026-05-04 10:00:00',
        'is_active' => true,
    ]);

    $response = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoices', [
            'invoice_no' => 'INV-1001',
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
                    'product_id' => $product->id,
                    'product_price_id' => $price->id,
                    'quantity' => 2,
                ],
            ],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.invoice_no', 'INV-1001')
        ->assertJsonPath('data.customer.name', 'Rahim Uddin')
        ->assertJsonPath('data.subtotal_amount', '120.00')
        ->assertJsonPath('data.discount_amount', '10.00')
        ->assertJsonPath('data.total_amount', '110.00')
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.items.0.product_name', 'Octane');

    expect(Customer::query()->where('mobile', '+8801700000011')->exists())->toBeTrue()
        ->and(Invoice::query()->where('invoice_no', 'INV-1001')->exists())->toBeTrue();
});

it('validates invoice totals and items', function () {
    $actor = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoices', [
            'invoice_no' => 'INV-BAD',
            'invoice_datetime' => '2026-05-04 11:00:00',
            'customer' => ['name' => 'Invalid Customer'],
            'payment_type' => 'cash',
            'discount_amount' => 10,
            'sms_enabled' => true,
            'status' => 'submitted',
            'items' => [],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items']);
});
