<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('call_rooms')
            ->where('status', 'initiated')
            ->update(['status' => 'calling']);

        Schema::table('call_rooms', function (Blueprint $table): void {
            $table->unsignedInteger('duration_seconds')->nullable()->after('ended_reason');
        });

        Schema::table('call_rooms', function (Blueprint $table): void {
            $table->enum('status', ['calling', 'ringing', 'connecting', 'active', 'ended', 'missed', 'declined', 'cancelled', 'failed'])->change();
        });
    }

    public function down(): void
    {
        DB::table('call_rooms')
            ->where('status', 'calling')
            ->update(['status' => 'initiated']);

        Schema::table('call_rooms', function (Blueprint $table): void {
            $table->enum('status', ['initiated', 'ringing', 'active', 'ended', 'missed', 'declined', 'cancelled', 'failed'])->change();
        });

        Schema::table('call_rooms', function (Blueprint $table): void {
            $table->dropColumn('duration_seconds');
        });
    }
};
