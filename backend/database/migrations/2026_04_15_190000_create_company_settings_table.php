<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('company_name', 160);
            $table->text('company_details')->nullable();
            $table->string('proprietor_name', 120)->nullable();
            $table->text('company_address')->nullable();
            $table->text('factory_address')->nullable();
            $table->string('company_mobile', 20)->nullable();
            $table->string('company_phone', 30)->nullable();
            $table->string('company_email', 120)->nullable();
            $table->string('trade_license', 80)->nullable();
            $table->string('tin_no', 80)->nullable();
            $table->string('bin_no', 80)->nullable();
            $table->string('vat_no', 80)->nullable();
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->string('currency', 10)->default('BDT');
            $table->string('company_logo', 2048)->nullable();
            $table->boolean('is_registration_enable')->default(true);
            $table->boolean('is_email_verification_enable')->default(false);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->index('company_name');
            $table->index('company_email');
            $table->index('company_mobile');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
