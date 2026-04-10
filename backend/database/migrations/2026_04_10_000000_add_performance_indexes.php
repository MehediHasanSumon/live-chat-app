<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndex('users', ['status', 'created_at'], 'users_status_created_at_idx');
        $this->addIndex('users', ['created_at'], 'users_created_at_idx');

        $this->addIndex('conversations', ['updated_at'], 'conversations_updated_at_idx');
        $this->addIndex('conversations', ['title'], 'conversations_title_idx');

        $this->addIndex('conversation_members', ['user_id', 'conversation_id'], 'conv_members_user_conversation_idx');
        $this->addIndex('conversation_members', ['joined_at'], 'conv_members_joined_at_idx');
        $this->addIndex('conversation_members', ['user_id', 'left_at'], 'conv_members_user_left_at_idx');

        $this->addIndex('messages', ['sender_id', 'created_at'], 'messages_sender_created_at_idx');
        $this->addIndex('messages', ['created_at'], 'messages_created_at_idx');
        $this->addIndex('messages', ['edited_at', 'conversation_id'], 'messages_edited_conversation_idx');
        $this->addIndex('messages', ['deleted_for_everyone_at', 'conversation_id'], 'messages_deleted_for_everyone_conversation_idx');

        $this->addIndex('message_reactions', ['message_id', 'user_id'], 'message_reactions_message_user_idx');
        $this->addIndex('message_reactions', ['emoji'], 'message_reactions_emoji_idx');
        $this->addIndex('message_reactions', ['created_at'], 'message_reactions_created_at_idx');

        $this->addIndex('message_hidden_for_users', ['user_id', 'message_id'], 'message_hidden_user_message_idx');

        $this->addIndex('message_attachments', ['message_id', 'created_at'], 'message_attachments_message_created_idx');
        $this->addIndex('message_attachments', ['storage_object_id', 'created_at'], 'message_attachments_storage_created_idx');

        $this->addIndex('call_rooms', ['created_by', 'created_at'], 'call_rooms_created_by_created_at_idx');
        $this->addIndex('call_rooms', ['status', 'created_at'], 'call_rooms_status_created_at_idx');
        $this->addIndex('call_rooms', ['started_at'], 'call_rooms_started_at_idx');
        $this->addIndex('call_rooms', ['ended_at'], 'call_rooms_ended_at_idx');

        $this->addIndex('call_room_participants', ['call_room_id', 'joined_at'], 'call_room_participants_room_joined_idx');
        $this->addIndex('call_room_participants', ['user_id', 'created_at'], 'call_room_participants_user_created_idx');
        $this->addIndex('call_room_participants', ['left_at'], 'call_room_participants_left_at_idx');

        $this->addIndex('storage_objects', ['owner_user_id', 'created_at'], 'storage_objects_owner_created_idx');
        $this->addIndex('storage_objects', ['media_kind', 'deleted_at'], 'storage_objects_media_deleted_idx');
        $this->addIndex('storage_objects', ['virus_scan_status'], 'storage_objects_virus_scan_status_idx');
        $this->addIndex('storage_objects', ['transcode_status'], 'storage_objects_transcode_status_idx');
        $this->addIndex('storage_objects', ['deleted_at', 'created_at'], 'storage_objects_deleted_created_idx');

        $this->addIndex('storage_usage_counters', ['updated_at'], 'storage_usage_counters_updated_at_idx');

        $this->addIndex('notifications_outbox', ['user_id', 'sent_at'], 'notifications_outbox_user_sent_at_idx');
        $this->addIndex('notifications_outbox', ['created_at', 'sent_at'], 'notifications_outbox_created_sent_idx');
        $this->addIndex('notifications_outbox', ['type'], 'notifications_outbox_type_idx');

        $this->addIndex('audit_logs', ['actor_user_id', 'created_at'], 'audit_logs_actor_created_idx');
        $this->addIndex('audit_logs', ['entity_type', 'entity_id'], 'audit_logs_entity_idx');
        $this->addIndex('audit_logs', ['action'], 'audit_logs_action_idx');
        $this->addIndex('audit_logs', ['created_at'], 'audit_logs_created_at_idx');

        $this->addIndex('user_devices', ['user_id', 'created_at'], 'user_devices_user_created_idx');
        $this->addIndex('user_devices', ['device_uuid'], 'user_devices_device_uuid_idx');

        $this->addIndex('user_blocks', ['blocker_user_id', 'blocked_user_id'], 'user_blocks_blocker_blocked_idx');
        $this->addIndex('user_restrictions', ['owner_user_id', 'target_user_id'], 'user_restrictions_owner_target_idx');

        $this->addIndex('cache', ['expiration'], 'cache_expiration_idx');
        $this->addIndex('jobs', ['queue', 'reserved_at'], 'jobs_queue_reserved_at_idx');
        $this->addIndex('failed_jobs', ['uuid'], 'failed_jobs_uuid_idx');
    }

    public function down(): void
    {
        $this->dropIndex('users', 'users_status_created_at_idx');
        $this->dropIndex('users', 'users_created_at_idx');

        $this->dropIndex('conversations', 'conversations_updated_at_idx');
        $this->dropIndex('conversations', 'conversations_title_idx');

        $this->dropIndex('conversation_members', 'conv_members_user_conversation_idx');
        $this->dropIndex('conversation_members', 'conv_members_joined_at_idx');
        $this->dropIndex('conversation_members', 'conv_members_user_left_at_idx');

        $this->dropIndex('messages', 'messages_sender_created_at_idx');
        $this->dropIndex('messages', 'messages_created_at_idx');
        $this->dropIndex('messages', 'messages_edited_conversation_idx');
        $this->dropIndex('messages', 'messages_deleted_for_everyone_conversation_idx');

        $this->dropIndex('message_reactions', 'message_reactions_message_user_idx');
        $this->dropIndex('message_reactions', 'message_reactions_emoji_idx');
        $this->dropIndex('message_reactions', 'message_reactions_created_at_idx');

        $this->dropIndex('message_hidden_for_users', 'message_hidden_user_message_idx');

        $this->dropIndex('message_attachments', 'message_attachments_message_created_idx');
        $this->dropIndex('message_attachments', 'message_attachments_storage_created_idx');

        $this->dropIndex('call_rooms', 'call_rooms_created_by_created_at_idx');
        $this->dropIndex('call_rooms', 'call_rooms_status_created_at_idx');
        $this->dropIndex('call_rooms', 'call_rooms_started_at_idx');
        $this->dropIndex('call_rooms', 'call_rooms_ended_at_idx');

        $this->dropIndex('call_room_participants', 'call_room_participants_room_joined_idx');
        $this->dropIndex('call_room_participants', 'call_room_participants_user_created_idx');
        $this->dropIndex('call_room_participants', 'call_room_participants_left_at_idx');

        $this->dropIndex('storage_objects', 'storage_objects_owner_created_idx');
        $this->dropIndex('storage_objects', 'storage_objects_media_deleted_idx');
        $this->dropIndex('storage_objects', 'storage_objects_virus_scan_status_idx');
        $this->dropIndex('storage_objects', 'storage_objects_transcode_status_idx');
        $this->dropIndex('storage_objects', 'storage_objects_deleted_created_idx');

        $this->dropIndex('storage_usage_counters', 'storage_usage_counters_updated_at_idx');

        $this->dropIndex('notifications_outbox', 'notifications_outbox_user_sent_at_idx');
        $this->dropIndex('notifications_outbox', 'notifications_outbox_created_sent_idx');
        $this->dropIndex('notifications_outbox', 'notifications_outbox_type_idx');

        $this->dropIndex('audit_logs', 'audit_logs_actor_created_idx');
        $this->dropIndex('audit_logs', 'audit_logs_entity_idx');
        $this->dropIndex('audit_logs', 'audit_logs_action_idx');
        $this->dropIndex('audit_logs', 'audit_logs_created_at_idx');

        $this->dropIndex('user_devices', 'user_devices_user_created_idx');
        $this->dropIndex('user_devices', 'user_devices_device_uuid_idx');

        $this->dropIndex('user_blocks', 'user_blocks_blocker_blocked_idx');
        $this->dropIndex('user_restrictions', 'user_restrictions_owner_target_idx');

        $this->dropIndex('cache', 'cache_expiration_idx');
        $this->dropIndex('jobs', 'jobs_queue_reserved_at_idx');
        $this->dropIndex('failed_jobs', 'failed_jobs_uuid_idx');
    }

    private function addIndex(string $table, array $columns, string $name): void
    {
        if (! Schema::hasTable($table) || ! $this->hasColumns($table, $columns)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $name) {
            $blueprint->index($columns, $name);
        });
    }

    private function dropIndex(string $table, string $name): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        try {
            Schema::table($table, function (Blueprint $blueprint) use ($name) {
                $blueprint->dropIndex($name);
            });
        } catch (Throwable) {
            // Ignore missing indexes during rollback.
        }
    }

    private function hasColumns(string $table, array $columns): bool
    {
        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return false;
            }
        }

        return true;
    }
};
