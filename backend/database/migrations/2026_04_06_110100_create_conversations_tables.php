<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['direct', 'group']);
            $table->char('direct_key', 64)->nullable()->unique();
            $table->string('title', 120)->nullable();
            $table->string('description', 255)->nullable();
            $table->foreignId('avatar_object_id')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->json('settings_json')->nullable();
            $table->unsignedBigInteger('last_message_seq')->default(0);
            $table->unsignedBigInteger('last_message_id')->nullable();
            $table->string('last_message_preview', 255)->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->char('active_room_uuid', 36)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'updated_at']);
        });

        Schema::create('conversation_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['owner', 'admin', 'member'])->default('member');
            $table->enum('membership_state', ['active', 'request_pending', 'invited', 'left', 'removed'])->default('active');
            $table->foreignId('added_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('request_created_at')->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamp('removed_at')->nullable();
            $table->unsignedBigInteger('last_read_seq')->default(0);
            $table->unsignedBigInteger('last_delivered_seq')->default(0);
            $table->unsignedInteger('unread_count_cache')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('pinned_at')->nullable();
            $table->timestamp('muted_until')->nullable();
            $table->enum('notifications_mode', ['all', 'mentions', 'mute', 'scheduled'])->default('all');
            $table->json('notification_schedule_json')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id'], 'conv_members_conv_user_uq');
            $table->index(['user_id', 'archived_at', 'pinned_at', 'updated_at'], 'conv_members_user_state_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_members');
        Schema::dropIfExists('conversations');
    }
};
