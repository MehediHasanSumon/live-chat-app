<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('seq');
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->char('client_uuid', 36)->nullable();
            $table->enum('type', ['text', 'voice', 'image', 'video', 'file', 'gif', 'system', 'call']);
            $table->string('sub_type', 40)->nullable();
            $table->text('text_body')->nullable();
            $table->foreignId('reply_to_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->json('quote_snapshot_json')->nullable();
            $table->foreignId('forwarded_from_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->foreignId('forwarded_from_conversation_id')->nullable()->constrained('conversations')->nullOnDelete();
            $table->foreignId('forwarded_from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata_json')->nullable();
            $table->boolean('is_edited')->default(false);
            $table->timestamp('edited_at')->nullable();
            $table->timestamp('editable_until_at')->nullable();
            $table->timestamp('deleted_for_everyone_at')->nullable();
            $table->foreignId('deleted_for_everyone_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['conversation_id', 'seq'], 'messages_conv_seq_uq');
            $table->unique(['conversation_id', 'sender_id', 'client_uuid'], 'messages_conv_sender_client_uq');
            $table->index(['conversation_id', 'created_at'], 'messages_conv_created_idx');
            $table->index('reply_to_message_id');
        });

        Schema::create('message_edits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version_no');
            $table->text('old_text')->nullable();
            $table->text('new_text')->nullable();
            $table->foreignId('edited_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('edited_at');

            $table->unique(['message_id', 'version_no']);
        });

        Schema::create('message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 32);
            $table->timestamp('created_at')->nullable();

            $table->unique(['message_id', 'user_id', 'emoji'], 'msg_reactions_msg_user_emoji_uq');
            $table->index(['message_id', 'created_at'], 'msg_reactions_msg_created_idx');
        });

        Schema::create('message_hidden_for_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('hidden_at');

            $table->unique(['message_id', 'user_id'], 'msg_hidden_msg_user_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_hidden_for_users');
        Schema::dropIfExists('message_reactions');
        Schema::dropIfExists('message_edits');
        Schema::dropIfExists('messages');
    }
};
