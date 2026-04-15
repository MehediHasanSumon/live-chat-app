<?php

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

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
        'unit_value' => 'liter',
        'unit_code' => 'PU001',
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

    $response = $this->actingAs($actor, 'web')
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
                    'product_id' => $product->id,
                    'product_price_id' => $price->id,
                    'quantity' => 2,
                ],
            ],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.invoice_no', 'INV-202605-00001')
        ->assertJsonPath('data.customer.name', 'Rahim Uddin')
        ->assertJsonPath('data.subtotal_amount', '120.00')
        ->assertJsonPath('data.discount_amount', '10.00')
        ->assertJsonPath('data.total_amount', '110.00')
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.items.0.product_name', 'Octane');

    expect(Customer::query()->where('mobile', '+8801700000011')->exists())->toBeTrue()
        ->and(Invoice::query()->where('invoice_no', 'INV-202605-00001')->exists())->toBeTrue();
});

it('reuses an existing customer by vehicle number when creating an invoice', function () {
    $actor = User::factory()->create();
    $customer = Customer::query()->create([
        'name' => 'Karim Uddin',
        'mobile' => null,
        'vehicle_no' => 'DHAKA-999',
    ]);
    $product = Product::query()->create([
        'product_name' => 'Diesel',
        'product_code' => 'DIESEL',
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

    $response = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoices', [
            'invoice_no' => 'INV-202605-00002',
            'invoice_datetime' => '2026-05-04 11:00:00',
            'customer' => [
                'name' => 'Karim Uddin',
                'mobile' => null,
                'vehicle_no' => 'DHAKA-999',
            ],
            'payment_type' => 'due',
            'discount_amount' => 0,
            'sms_enabled' => false,
            'status' => 'submitted',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_price_id' => $price->id,
                    'quantity' => 1,
                ],
            ],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.customer.id', $customer->id)
        ->assertJsonPath('data.customer.vehicle_no', 'DHAKA-999');

    expect(Customer::query()->where('vehicle_no', 'DHAKA-999')->count())->toBe(1);
});

it('generates the next invoice number by year and month', function () {
    $actor = User::factory()->create();
    $customer = Customer::query()->create([
        'name' => 'Rahim Uddin',
        'mobile' => '+8801700000011',
        'vehicle_no' => 'DHAKA-123',
    ]);

    Invoice::query()->create([
        'invoice_no' => 'INV-202605-00001',
        'invoice_datetime' => '2026-05-04 11:00:00',
        'customer_id' => $customer->id,
        'payment_type' => 'cash',
        'payment_status' => 'paid',
        'subtotal_amount' => 100,
        'discount_amount' => 0,
        'total_amount' => 100,
        'paid_amount' => 100,
        'due_amount' => 0,
        'sms_enabled' => false,
        'status' => 'submitted',
    ]);

    $this->actingAs($actor, 'web')
        ->getJson('/api/admin/invoices/next-number?date=2026-05-15')
        ->assertOk()
        ->assertJsonPath('data.invoice_no', 'INV-202605-00002');

    $this->actingAs($actor, 'web')
        ->getJson('/api/admin/invoices/next-number?date=2026-06-01')
        ->assertOk()
        ->assertJsonPath('data.invoice_no', 'INV-202606-00001');
});

it('creates product units with generated codes and slug values', function () {
    $actor = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/product-units', [
            'unit_name' => 'Liter',
            'unit_value' => 'Liter',
        ])
        ->assertCreated()
        ->assertJsonPath('data.unit_name', 'Liter')
        ->assertJsonPath('data.unit_value', 'liter')
        ->assertJsonPath('data.unit_code', 'PU001');

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/product-units', [
            'unit_name' => 'Gallon',
            'unit_value' => 'gallon',
        ])
        ->assertCreated()
        ->assertJsonPath('data.unit_code', 'PU002');
});

it('creates products with generated codes', function () {
    $actor = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/products', [
            'product_name' => 'Petrol',
            'description' => null,
            'status' => 'active',
        ])
        ->assertCreated()
        ->assertJsonPath('data.product_name', 'Petrol')
        ->assertJsonPath('data.product_code', 'P001');

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/products', [
            'product_name' => 'Octane',
            'description' => null,
            'status' => 'active',
        ])
        ->assertCreated()
        ->assertJsonPath('data.product_code', 'P002');
});

it('uses the current backend time when product price receives a date only value', function () {
    Carbon::setTestNow(Carbon::parse('2026-05-04 15:45:12'));
    $actor = User::factory()->create();
    $product = Product::query()->create([
        'product_name' => 'Diesel',
        'product_code' => 'P001',
        'status' => 'active',
    ]);

    $response = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/product-prices', [
            'product_id' => $product->id,
            'product_unit_id' => null,
            'original_price' => 50,
            'sell_price' => 60,
            'date_time' => '2026-05-04',
            'is_active' => true,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.date_time', '2026-05-04T15:45:12+00:00');

    Carbon::setTestNow();
});

it('validates invoice totals and items', function () {
    $actor = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/invoices', [
            'invoice_no' => 'INV-202605-99999',
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
