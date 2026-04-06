<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('avatar_object_id')->references('id')->on('storage_objects')->nullOnDelete();
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreign('avatar_object_id')->references('id')->on('storage_objects')->nullOnDelete();
            $table->foreign('last_message_id')->references('id')->on('messages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropForeign(['avatar_object_id']);
            $table->dropForeign(['last_message_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['avatar_object_id']);
        });
    }
};
