<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications_outbox', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['new_message', 'call_invite', 'mention', 'request', 'summary', 'system']);
            $table->string('title', 160);
            $table->string('body', 255);
            $table->json('payload_json')->nullable();
            $table->enum('provider', ['fcm', 'apns', 'webpush', 'websocket', 'internal']);
            $table->timestamp('schedule_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->enum('status', ['queued', 'sent', 'failed', 'suppressed', 'cancelled'])->default('queued');
            $table->string('failure_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'schedule_at'], 'notif_outbox_user_status_schedule_idx');
        });

        Schema::create('storage_policies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('global_cap_bytes')->default(21474836480);
            $table->boolean('auto_cleanup_enabled')->default(true);
            $table->unsignedBigInteger('large_file_threshold_bytes')->default(1048576);
            $table->boolean('large_file_rule_enabled')->default(true);
            $table->unsignedInteger('large_file_delete_after_days')->default(7);
            $table->unsignedBigInteger('small_file_threshold_bytes')->default(1048576);
            $table->boolean('small_file_rule_enabled')->default(true);
            $table->unsignedInteger('small_file_delete_after_days')->default(30);
            $table->enum('cleanup_behavior', ['delete_binary_keep_message'])->default('delete_binary_keep_message');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('storage_usage_counters', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('live_object_count')->default(0);
            $table->unsignedBigInteger('live_bytes')->default(0);
            $table->unsignedBigInteger('deleted_bytes_total')->default(0);
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('storage_cleanup_runs', function (Blueprint $table) {
            $table->id();
            $table->enum('rule_key', ['large_after_7d', 'small_after_30d', 'manual']);
            $table->boolean('dry_run')->default(false);
            $table->enum('status', ['running', 'completed', 'failed']);
            $table->unsignedBigInteger('objects_scanned')->default(0);
            $table->unsignedBigInteger('objects_deleted')->default(0);
            $table->unsignedBigInteger('bytes_freed')->default(0);
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->text('notes')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('action', 50);
            $table->json('before_json')->nullable();
            $table->json('after_json')->nullable();
            $table->string('ip_address', 64)->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('storage_cleanup_runs');
        Schema::dropIfExists('storage_usage_counters');
        Schema::dropIfExists('storage_policies');
        Schema::dropIfExists('notifications_outbox');
    }
};
