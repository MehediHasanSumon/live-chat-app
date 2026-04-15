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
        Schema::table('product_units', function (Blueprint $table) {
            $table->string('unit_value', 80)->change();
            $table->index('unit_value');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('unit_value', 80)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->decimal('unit_value', 12, 4)->default(1)->change();
        });

        Schema::table('product_units', function (Blueprint $table) {
            $table->dropIndex(['unit_value']);
            $table->decimal('unit_value', 12, 4)->default(1)->change();
        });
    }
};
