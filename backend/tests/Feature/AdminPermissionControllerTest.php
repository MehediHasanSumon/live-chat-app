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
        ->assertJsonPath('data.0.name', 'admin.ops.view')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 10);
});

it('paginates permissions from the server', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    foreach (range(1, 13) as $index) {
        Permission::findOrCreate(sprintf('feature.%02d', $index), 'web');
    }

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/permissions?page=2&per_page=5');

    $response
        ->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.per_page', 5)
        ->assertJsonPath('meta.total', 15)
        ->assertJsonPath('meta.last_page', 3);
});

it('filters permissions by search on the server', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    Permission::findOrCreate('reports.view', 'web');
    Permission::findOrCreate('reports.export', 'web');
    Permission::findOrCreate('messages.delete', 'web');

    $response = $this->actingAs($user, 'web')
        ->getJson('/api/admin/permissions?search=reports&per_page=10');

    $response
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'reports.export')
        ->assertJsonPath('data.1.name', 'reports.view')
        ->assertJsonPath('meta.total', 2);
});

it('downloads the filtered permissions list as a pdf', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create();

    Permission::findOrCreate('reports.view', 'web');
    Permission::findOrCreate('reports.export', 'web');

    $response = $this->actingAs($user, 'web')
        ->get('/api/admin/permissions/export/pdf?search=reports');

    $response
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf')
        ->assertHeader('content-disposition');

    expect($response->getContent())->toContain('%PDF');
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
