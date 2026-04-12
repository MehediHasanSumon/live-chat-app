<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->char('call_room_uuid', 36)->nullable()->after('client_uuid');
            $table->unique('call_room_uuid', 'messages_call_room_uuid_uq');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->dropUnique('messages_call_room_uuid_uq');
            $table->dropColumn('call_room_uuid');
        });
    }
};
