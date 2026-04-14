<?php

use App\Models\AuditLog;
use App\Models\StorageCleanupRun;
use App\Models\StorageObject;
use App\Models\StoragePolicy;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('shows and updates storage policy while writing an audit log', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $showResponse = $this->actingAs($admin, 'web')
        ->getJson('/api/admin/storage/policy');

    $showResponse
        ->assertOk()
        ->assertJsonPath('data.global_cap_bytes', 21474836480);

    $updateResponse = $this->actingAs($admin, 'web')
        ->patchJson('/api/admin/storage/policy', [
            'global_cap_bytes' => 1024 * 1024 * 1024,
            'large_file_delete_after_days' => 10,
            'small_file_delete_after_days' => 45,
        ]);

    $updateResponse
        ->assertOk()
        ->assertJsonPath('data.global_cap_bytes', 1024 * 1024 * 1024)
        ->assertJsonPath('data.large_file_delete_after_days', 10)
        ->assertJsonPath('data.small_file_delete_after_days', 45);

    expect(StoragePolicy::query()->firstOrFail()->global_cap_bytes)->toBe(1024 * 1024 * 1024)
        ->and(AuditLog::query()->where('action', 'policy_updated')->count())->toBe(1);
});

it('previews and runs cleanup for eligible large files and records audit trails', function () {
    Storage::fake(config('uploads.disk'));

    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $diskPath = 'uploads/2026/04/cleanup-large.bin';

    Storage::disk(config('uploads.disk'))->put($diskPath, str_repeat('A', 2_000_000));

    $storageObject = StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'owner_user_id' => $admin->id,
        'purpose' => 'message_attachment',
        'media_kind' => 'file',
        'storage_driver' => 'local',
        'disk_path' => $diskPath,
        'original_name' => 'cleanup-large.bin',
        'mime_type' => 'application/octet-stream',
        'file_ext' => 'bin',
        'size_bytes' => 2_000_000,
        'virus_scan_status' => 'clean',
        'transcode_status' => 'ready',
        'retention_mode' => 'default',
        'delete_eligible_at' => now()->subDay(),
    ]);

    $previewResponse = $this->actingAs($admin, 'web')
        ->postJson('/api/admin/storage/cleanup/preview', [
            'rule_key' => 'large_after_7d',
        ]);

    $previewResponse
        ->assertOk()
        ->assertJsonPath('data.rule_key', 'large_after_7d')
        ->assertJsonPath('data.objects_scanned', 1)
        ->assertJsonPath('data.objects.0.id', $storageObject->id);

    $runResponse = $this->actingAs($admin, 'web')
        ->postJson('/api/admin/storage/cleanup/run', [
            'rule_key' => 'large_after_7d',
        ]);

    $runResponse
        ->assertOk()
        ->assertJsonPath('data.rule_key', 'large_after_7d')
        ->assertJsonPath('data.objects_scanned', 1)
        ->assertJsonPath('data.objects_deleted', 1)
        ->assertJsonPath('data.bytes_freed', 2_000_000);

    Storage::disk(config('uploads.disk'))->assertMissing($diskPath);

    expect($storageObject->fresh()->deleted_reason)->toBe('policy_large_after_7d')
        ->and(StorageCleanupRun::query()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'deleted_by_policy')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'cleanup_executed')->count())->toBe(1);
});

it('supports exempting and removing exemptions with audit logs', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $storageObject = StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'owner_user_id' => $admin->id,
        'purpose' => 'message_attachment',
        'media_kind' => 'file',
        'storage_driver' => 'local',
        'disk_path' => 'uploads/2026/04/exempt.txt',
        'original_name' => 'exempt.txt',
        'mime_type' => 'text/plain',
        'file_ext' => 'txt',
        'size_bytes' => 512,
        'virus_scan_status' => 'clean',
        'transcode_status' => 'ready',
        'retention_mode' => 'default',
        'delete_eligible_at' => now()->addDays(30),
    ]);

    $this->actingAs($admin, 'web')
        ->postJson("/api/admin/storage/objects/{$storageObject->id}/exempt")
        ->assertOk()
        ->assertJsonPath('data.retention_mode', 'exempt')
        ->assertJsonPath('data.delete_eligible_at', null);

    $this->actingAs($admin, 'web')
        ->deleteJson("/api/admin/storage/objects/{$storageObject->id}/exempt")
        ->assertOk()
        ->assertJsonPath('data.retention_mode', 'default');

    expect(AuditLog::query()->where('action', 'exempted')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'exemption_removed')->count())->toBe(1);
});

it('runs storage cleanup artisan commands and recalculates usage', function () {
    Storage::fake(config('uploads.disk'));

    $diskPath = 'uploads/2026/04/cleanup-small.txt';
    Storage::disk(config('uploads.disk'))->put($diskPath, str_repeat('B', 500));

    StorageObject::query()->create([
        'object_uuid' => (string) str()->uuid(),
        'purpose' => 'message_attachment',
        'media_kind' => 'file',
        'storage_driver' => 'local',
        'disk_path' => $diskPath,
        'original_name' => 'cleanup-small.txt',
        'mime_type' => 'text/plain',
        'file_ext' => 'txt',
        'size_bytes' => 500,
        'virus_scan_status' => 'clean',
        'transcode_status' => 'ready',
        'retention_mode' => 'default',
        'delete_eligible_at' => now()->subDay(),
    ]);

    $this->artisan('chat:cleanup-small-files')
        ->expectsOutputToContain('Cleanup completed.')
        ->assertExitCode(0);

    $this->artisan('chat:recalculate-storage')
        ->expectsOutputToContain('Storage recalculated.')
        ->assertExitCode(0);

    expect(StorageCleanupRun::query()->where('rule_key', 'small_after_30d')->exists())->toBeTrue();
});
