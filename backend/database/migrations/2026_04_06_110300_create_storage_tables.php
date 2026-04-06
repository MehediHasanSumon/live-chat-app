<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_objects', function (Blueprint $table) {
            $table->id();
            $table->char('object_uuid', 36)->unique();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('purpose', ['message_attachment', 'user_avatar', 'group_avatar']);
            $table->enum('media_kind', ['image', 'video', 'audio', 'voice', 'file', 'gif']);
            $table->enum('storage_driver', ['local'])->default('local');
            $table->string('disk_path', 255);
            $table->string('original_name', 255);
            $table->string('mime_type', 120);
            $table->string('file_ext', 20)->nullable();
            $table->unsignedBigInteger('size_bytes');
            $table->char('checksum_sha256', 64)->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->json('waveform_json')->nullable();
            $table->string('thumbnail_path', 255)->nullable();
            $table->string('preview_blurhash', 255)->nullable();
            $table->enum('virus_scan_status', ['pending', 'clean', 'infected', 'failed'])->default('pending');
            $table->enum('transcode_status', ['pending', 'processing', 'ready', 'failed'])->default('ready');
            $table->unsignedInteger('ref_count')->default(0);
            $table->timestamp('first_attached_at')->nullable();
            $table->timestamp('last_attached_at')->nullable();
            $table->enum('retention_mode', ['default', 'exempt'])->default('default');
            $table->timestamp('delete_eligible_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_reason', 100)->nullable();
            $table->timestamps();

            $table->index(['media_kind', 'created_at'], 'storage_media_created_idx');
            $table->index(['size_bytes', 'created_at'], 'storage_size_created_idx');
            $table->index(['delete_eligible_at', 'deleted_at'], 'storage_delete_window_idx');
        });

        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storage_object_id')->constrained('storage_objects')->cascadeOnDelete();
            $table->foreignId('uploader_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedSmallInteger('display_order')->default(1);
            $table->timestamp('created_at')->nullable();

            $table->unique(['message_id', 'storage_object_id'], 'msg_attach_msg_object_uq');
            $table->index(['conversation_id', 'created_at'], 'msg_attach_conv_created_idx');
            $table->index('storage_object_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('storage_objects');
    }
};
