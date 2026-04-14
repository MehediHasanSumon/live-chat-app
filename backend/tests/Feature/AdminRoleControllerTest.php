<?php

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

it('returns paginated roles for authenticated users', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/roles?per_page=1');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 1)
        ->assertJsonPath('meta.total', 2);
});

it('filters roles by search on the server', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    Role::findOrCreate('support-agent', 'web');

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/roles?search=support&per_page=10');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'support-agent')
        ->assertJsonPath('meta.total', 1);
});

it('creates a role with multiple permissions', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    Permission::findOrCreate('reports.view', 'web');
    Permission::findOrCreate('reports.export', 'web');

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/admin/roles', [
            'name' => 'report-manager',
            'permissions' => ['reports.view', 'reports.export'],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.name', 'report-manager')
        ->assertJsonPath('data.permissions_count', 2)
        ->assertJsonPath('data.permissions.0.name', 'reports.export')
        ->assertJsonPath('data.permissions.1.name', 'reports.view');

    expect(Role::findByName('report-manager', 'web')->permissions()->count())->toBe(2);
});

it('updates a role and syncs permissions', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    Permission::findOrCreate('reports.view', 'web');
    Permission::findOrCreate('reports.export', 'web');
    $role = Role::findOrCreate('report-manager', 'web');
    $role->syncPermissions(['reports.view']);

    $response = $this->actingAs($user, 'web')
        ->patchJson("/api/admin/roles/{$role->id}", [
            'name' => 'report-admin',
            'permissions' => ['reports.export'],
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.name', 'report-admin')
        ->assertJsonPath('data.permissions_count', 1)
        ->assertJsonPath('data.permissions.0.name', 'reports.export');

    expect(Role::findByName('report-admin', 'web')->hasPermissionTo('reports.export'))->toBeTrue();
});

it('deletes a role', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    $role = Role::findOrCreate('temporary-role', 'web');

    $this->actingAs($user, 'web')
        ->deleteJson("/api/admin/roles/{$role->id}")
        ->assertNoContent();

    expect(Role::query()->whereKey($role->id)->exists())->toBeFalse();
});

it('returns permission options for role forms', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();
    Permission::findOrCreate('reports.view', 'web');

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/permissions/options');

    $response
        ->assertOk()
        ->assertJsonPath('data.0.name', 'admin.ops.view')
        ->assertJsonPath('data.2.name', 'reports.view');
});
