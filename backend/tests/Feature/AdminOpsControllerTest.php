<?php

use App\Models\CallRoom;
use App\Models\Conversation;
use App\Models\NotificationOutbox;
use App\Models\StorageObject;
use App\Models\StoragePolicy;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('forbids admin ops access for users without the required role or permission', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->getJson('/api/admin/ops/health')
        ->assertForbidden();
});

it('returns admin ops health details', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $user->assignRole('admin');

    DB::table('jobs')->insert([
        'queue' => config('queue.queues.notifications', 'notifications'),
        'payload' => json_encode(['job' => 'test']),
        'attempts' => 0,
        'reserved_at' => null,
        'available_at' => now()->timestamp,
        'created_at' => now()->timestamp,
    ]);

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/ops/health');

    $response
        ->assertOk()
        ->assertJsonPath('data.overall_status', 'ok')
        ->assertJsonPath('data.services.database.status', 'ok')
        ->assertJsonPath('data.services.cache.status', 'ok')
        ->assertJsonPath('data.services.queue.status', 'ok')
        ->assertJsonPath('data.services.reverb.configured', true)
        ->assertJsonPath('data.services.livekit.configured', true);
});

it('returns admin ops status details including queue separation and counters', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $user->assignRole('admin');

    $conversation = Conversation::query()->create([
        'type' => 'group',
        'title' => 'Ops',
        'created_by' => $user->id,
    ]);

    CallRoom::query()->create([
        'room_uuid' => (string) str()->uuid(),
        'conversation_id' => $conversation->id,
        'scope' => 'group',
        'media_type' => 'voice',
        'created_by' => $user->id,
        'status' => 'active',
        'max_participants' => 3,
        'max_video_publishers' => 0,
    ]);

    NotificationOutbox::query()->create([
        'user_id' => $user->id,
        'type' => 'new_message',
        'title' => 'Queued',
        'body' => 'Queued body',
        'provider' => 'websocket',
        'status' => 'queued',
    ]);

    NotificationOutbox::query()->create([
        'user_id' => $user->id,
        'type' => 'summary',
        'title' => 'Scheduled',
        'body' => 'Scheduled body',
        'provider' => 'websocket',
        'status' => 'queued',
        'schedule_at' => now()->subMinute(),
    ]);

    StoragePolicy::query()->create([
        'updated_at' => now(),
    ]);

    StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'purpose' => 'message_attachment',
        'media_kind' => 'file',
        'storage_driver' => 'local',
        'disk_path' => 'private/docs-1.pdf',
        'original_name' => 'docs-1.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 2048,
    ]);

    StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'purpose' => 'message_attachment',
        'media_kind' => 'file',
        'storage_driver' => 'local',
        'disk_path' => 'private/docs-2.pdf',
        'original_name' => 'docs-2.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 2048,
    ]);

    DB::table('jobs')->insert([
        [
            'queue' => config('queue.queues.notifications', 'notifications'),
            'payload' => json_encode(['job' => 'notif']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
        ],
        [
            'queue' => config('queue.queues.media', 'media'),
            'payload' => json_encode(['job' => 'media']),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
        ],
    ]);

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/ops/status');

    $response
        ->assertOk()
        ->assertJsonPath('data.queues.names.notifications', config('queue.queues.notifications'))
        ->assertJsonPath('data.queues.names.media', config('queue.queues.media'))
        ->assertJsonPath('data.notifications.outbox.queued', 2)
        ->assertJsonPath('data.notifications.outbox.scheduled_due', 1)
        ->assertJsonPath('data.calls.active', 1)
        ->assertJsonPath('data.storage.usage.live_bytes', 4096)
        ->assertJsonPath('data.horizon.configured', true);
});
