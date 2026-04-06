<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->enum('theme', ['system', 'light', 'dark'])->default('system');
            $table->boolean('show_active_status')->default(true);
            $table->boolean('allow_message_requests')->default(true);
            $table->boolean('push_enabled')->default(true);
            $table->boolean('sound_enabled')->default(true);
            $table->boolean('vibrate_enabled')->default(true);
            $table->boolean('quiet_hours_enabled')->default(false);
            $table->time('quiet_hours_start')->nullable();
            $table->time('quiet_hours_end')->nullable();
            $table->string('quiet_hours_timezone', 64)->default('Asia/Dhaka');
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('user_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_uuid', 80);
            $table->enum('platform', ['web', 'android', 'ios']);
            $table->string('device_name', 120);
            $table->enum('push_provider', ['fcm', 'apns', 'webpush', 'none'])->default('none');
            $table->text('push_token')->nullable();
            $table->string('app_version', 32)->nullable();
            $table->string('build_number', 32)->nullable();
            $table->string('locale', 16)->nullable();
            $table->string('timezone', 64)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_uuid']);
        });

        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('block_chat')->default(true);
            $table->boolean('block_call')->default(true);
            $table->boolean('hide_presence')->default(true);
            $table->timestamp('created_at')->nullable();

            $table->unique(['blocker_user_id', 'blocked_user_id']);
        });

        Schema::create('user_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('move_to_requests')->default(true);
            $table->boolean('mute_notifications')->default(true);
            $table->boolean('prevent_calling')->default(true);
            $table->timestamp('created_at')->nullable();

            $table->unique(['owner_user_id', 'target_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_restrictions');
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('user_devices');
        Schema::dropIfExists('user_settings');
    }
};
