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
        Schema::create('sms_service_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('url', 2048);
            $table->text('api_key');
            $table->string('sender_id', 120);
            $table->enum('status', ['active', 'inactive'])->default('inactive');
            $table->timestamps();

            $table->index('sender_id');
            $table->index('status');
        });

        Schema::create('invoice_sms_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->text('body');
            $table->json('variables_json')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('is_default')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('name');
            $table->index('status');
            $table->index('is_default');
            $table->index(['status', 'is_default']);
        });

        Schema::table('invoice_sms_logs', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('sms_service_credential_id')->nullable()->constrained('sms_service_credentials')->nullOnDelete();
            $table->foreignId('invoice_sms_template_id')->nullable()->constrained('invoice_sms_templates')->nullOnDelete();
            $table->string('recipient_name', 120)->nullable();
            $table->string('sender_id', 120)->nullable();

            $table->index('customer_id');
            $table->index('sms_service_credential_id');
            $table->index('invoice_sms_template_id');
            $table->index('sender_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoice_sms_logs', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropForeign(['sms_service_credential_id']);
            $table->dropForeign(['invoice_sms_template_id']);
            $table->dropColumn([
                'customer_id',
                'sms_service_credential_id',
                'invoice_sms_template_id',
                'recipient_name',
                'sender_id',
            ]);
        });

        Schema::dropIfExists('invoice_sms_templates');
        Schema::dropIfExists('sms_service_credentials');
    }
};
