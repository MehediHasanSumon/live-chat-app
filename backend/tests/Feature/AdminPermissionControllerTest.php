<?php

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

it('returns the permission list for authenticated users', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/permissions');

    $response
        ->assertOk()
        ->assertJsonPath('data.0.name', 'admin.ops.view');
});

it('creates a custom permission', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/admin/permissions', [
            'name' => 'reports.export',
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.name', 'reports.export');

    expect(Permission::findByName('reports.export', 'web'))->not->toBeNull();
});

it('updates a custom permission name', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $permission = Permission::findOrCreate('reports.view', 'web');

    $response = $this->actingAs($user, 'web')
        ->patchJson("/api/admin/permissions/{$permission->id}", [
            'name' => 'reports.manage',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.name', 'reports.manage');

    expect(Permission::findByName('reports.manage', 'web'))->not->toBeNull();
});

it('deletes a custom permission', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $permission = Permission::findOrCreate('reports.delete', 'web');

    $this->actingAs($user, 'web')
        ->deleteJson("/api/admin/permissions/{$permission->id}")
        ->assertNoContent();

    expect(Permission::query()->whereKey($permission->id)->exists())->toBeFalse();
});

it('allows mutating seeded permissions for simple crud', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $permission = Permission::findByName('admin.ops.view', 'web');

    $this->actingAs($user, 'web')
        ->patchJson("/api/admin/permissions/{$permission->id}", [
            'name' => 'admin.ops.manage',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'admin.ops.manage');

    $this->actingAs($user, 'web')
        ->deleteJson("/api/admin/permissions/{$permission->id}")
        ->assertNoContent();

    expect(Permission::query()->whereKey($permission->id)->exists())->toBeFalse();
});
