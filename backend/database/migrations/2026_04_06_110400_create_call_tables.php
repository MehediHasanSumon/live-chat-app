<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('call_rooms', function (Blueprint $table) {
            $table->id();
            $table->char('room_uuid', 36)->unique();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->enum('scope', ['direct', 'group']);
            $table->enum('media_type', ['voice', 'video']);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->enum('status', ['initiated', 'ringing', 'active', 'ended', 'missed', 'declined', 'cancelled', 'failed']);
            $table->unsignedSmallInteger('max_participants')->default(12);
            $table->unsignedSmallInteger('max_video_publishers')->default(4);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->string('ended_reason', 60)->nullable();
            $table->timestamp('last_webhook_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'status', 'created_at'], 'call_rooms_conv_status_created_idx');
        });

        Schema::create('call_room_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('invite_status', ['invited', 'ringing', 'accepted', 'declined', 'missed', 'left', 'kicked']);
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->string('left_reason', 60)->nullable();
            $table->boolean('is_video_publisher')->default(false);
            $table->timestamps();

            $table->unique(['call_room_id', 'user_id'], 'call_room_participants_room_user_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_room_participants');
        Schema::dropIfExists('call_rooms');
    }
};
