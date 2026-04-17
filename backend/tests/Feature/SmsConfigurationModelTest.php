<?php

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceSmsLog;
use App\Models\InvoiceSmsTemplate;
use App\Models\SmsServiceCredential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('keeps only one sms service credential active', function () {
    $first = SmsServiceCredential::query()->create([
        'url' => 'https://sms.example.com/send',
        'api_key' => 'first-secret',
        'sender_id' => 'SHOP',
        'status' => 'active',
    ]);

    $second = SmsServiceCredential::query()->create([
        'url' => 'https://sms2.example.com/send',
        'api_key' => 'second-secret',
        'sender_id' => 'SHOP2',
        'status' => 'active',
    ]);

    expect($first->fresh()->status)->toBe('inactive')
        ->and($second->fresh()->status)->toBe('active')
        ->and(SmsServiceCredential::query()->where('status', 'active')->count())->toBe(1);
});

it('renders invoice sms templates with invoice variables', function () {
    $customer = Customer::query()->create([
        'name' => 'Sumon Customer',
        'mobile' => '+8801700000000',
        'vehicle_no' => 'DHA-123',
    ]);

    $invoice = Invoice::query()->create([
        'invoice_no' => 'INV-202604-0001',
        'invoice_datetime' => now(),
        'customer_id' => $customer->id,
        'payment_type' => 'cash',
        'payment_status' => 'paid',
        'subtotal_amount' => 1000,
        'discount_amount' => 100,
        'total_amount' => 900,
        'paid_amount' => 900,
        'due_amount' => 0,
        'sms_enabled' => true,
        'status' => 'submitted',
    ]);

    $invoice->items()->create([
        'product_name' => 'Engine Oil',
        'unit_name' => 'Piece',
        'unit_code' => 'pcs',
        'unit_value' => 1,
        'price' => 900,
        'quantity' => 1,
        'line_total' => 900,
    ]);

    $template = InvoiceSmsTemplate::query()->create([
        'name' => 'Invoice confirmation',
        'body' => 'Dear {customer_name}, invoice {{ invoice_no }} total {total_amount}. Items: {items}',
        'variables_json' => InvoiceSmsTemplate::VARIABLES,
        'status' => 'active',
        'is_default' => true,
    ]);

    expect($template->renderForInvoice($invoice))->toBe(
        'Dear Sumon Customer, invoice INV-202604-0001 total 900.00. Items: Engine Oil 1.0000 pcs x 900.00'
    );
});

it('connects invoice sms logs to invoices customers credentials and templates', function () {
    $user = User::factory()->create();
    $customer = Customer::query()->create([
        'name' => 'Log Customer',
        'mobile' => '+8801711111111',
    ]);
    $invoice = Invoice::query()->create([
        'invoice_no' => 'INV-202604-0002',
        'invoice_datetime' => now(),
        'customer_id' => $customer->id,
        'payment_type' => 'due',
        'payment_status' => 'unpaid',
        'subtotal_amount' => 500,
        'discount_amount' => 0,
        'total_amount' => 500,
        'paid_amount' => 0,
        'due_amount' => 500,
        'sms_enabled' => true,
        'status' => 'submitted',
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);
    $credential = SmsServiceCredential::query()->create([
        'url' => 'https://sms.example.com/send',
        'api_key' => 'secret',
        'sender_id' => 'SHOP',
        'status' => 'active',
    ]);
    $template = InvoiceSmsTemplate::query()->create([
        'name' => 'Due invoice',
        'body' => 'Due {due_amount}',
        'status' => 'active',
        'is_default' => true,
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);

    $log = InvoiceSmsLog::query()->create([
        'invoice_id' => $invoice->id,
        'customer_id' => $customer->id,
        'sms_service_credential_id' => $credential->id,
        'invoice_sms_template_id' => $template->id,
        'recipient_name' => $customer->name,
        'mobile' => $customer->mobile,
        'sender_id' => $credential->sender_id,
        'message' => 'Due 500.00',
        'status' => 'sent',
        'provider_response' => ['message_id' => 'abc-123'],
        'sent_at' => now(),
    ]);

    expect($log->invoice->is($invoice))->toBeTrue()
        ->and($log->customer->is($customer))->toBeTrue()
        ->and($log->credential->is($credential))->toBeTrue()
        ->and($log->template->is($template))->toBeTrue()
        ->and($invoice->smsLogs()->count())->toBe(1)
        ->and($customer->smsLogs()->count())->toBe(1)
        ->and($credential->invoiceSmsLogs()->count())->toBe(1)
        ->and($template->smsLogs()->count())->toBe(1)
        ->and($user->createdInvoiceSmsTemplates()->count())->toBe(1)
        ->and($user->updatedInvoiceSmsTemplates()->count())->toBe(1);
});
