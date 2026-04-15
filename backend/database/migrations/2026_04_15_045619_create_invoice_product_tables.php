<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('product_name', 120);
            $table->string('product_code', 50)->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->unique('product_code');
            $table->index('product_name');
            $table->index('status');
        });

        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->string('unit_name', 60);
            $table->decimal('unit_value', 12, 4)->default(1);
            $table->string('unit_code', 20);
            $table->timestamps();

            $table->unique('unit_code');
            $table->index('unit_name');
        });

        Schema::create('product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->nullOnDelete();
            $table->decimal('original_price', 12, 2);
            $table->decimal('sell_price', 12, 2);
            $table->dateTime('date_time');
            $table->boolean('is_active')->default(false);
            $table->unsignedBigInteger('active_product_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('deactivated_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique('active_product_id');
            $table->index('product_id');
            $table->index('product_unit_id');
            $table->index('date_time');
            $table->index('is_active');
            $table->index(['product_id', 'date_time']);
            $table->index(['product_id', 'is_active']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('mobile', 20)->nullable();
            $table->string('vehicle_no', 50)->nullable();
            $table->timestamps();

            $table->index('name');
            $table->index('mobile');
            $table->index('vehicle_no');
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_no', 50);
            $table->dateTime('invoice_datetime');
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->enum('payment_type', ['due', 'cash', 'pos'])->default('cash');
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('paid');
            $table->decimal('subtotal_amount', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('due_amount', 12, 2)->default(0);
            $table->boolean('sms_enabled')->default(false);
            $table->enum('status', ['draft', 'submitted', 'cancelled'])->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('invoice_no');
            $table->index('invoice_datetime');
            $table->index('customer_id');
            $table->index('payment_type');
            $table->index('payment_status');
            $table->index('status');
            $table->index('created_by');
            $table->index(['status', 'invoice_datetime']);
            $table->index(['payment_type', 'invoice_datetime']);
            $table->index(['customer_id', 'invoice_datetime']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('product_price_id')->nullable()->constrained('product_prices')->nullOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->nullOnDelete();
            $table->string('product_name', 120);
            $table->string('unit_name', 60)->nullable();
            $table->string('unit_code', 20)->nullable();
            $table->decimal('unit_value', 12, 4)->default(1);
            $table->decimal('price', 12, 2);
            $table->decimal('quantity', 12, 4);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index('invoice_id');
            $table->index('product_id');
            $table->index('product_price_id');
            $table->index('product_unit_id');
            $table->index(['invoice_id', 'product_id']);
        });

        Schema::create('invoice_sms_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('mobile', 20);
            $table->text('message')->nullable();
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->json('provider_response')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index('invoice_id');
            $table->index('mobile');
            $table->index('status');
            $table->index('sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_sms_logs');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('product_prices');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('products');
    }
};
