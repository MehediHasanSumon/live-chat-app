<?php

use App\Models\AuthVerificationCode;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

it('returns paginated users for authenticated users', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create(['name' => 'Actor User']);
    User::factory()->create(['name' => 'Alice Example']);
    User::factory()->create(['name' => 'Bob Example']);

    $response = $this->actingAs($actor, 'web')
        ->getJson('/api/admin/users?per_page=2');

    $response
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 2)
        ->assertJsonPath('meta.total', 3);
});

it('filters users by search on the server', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    User::factory()->create(['name' => 'Alice Example', 'email' => 'alice@example.test']);
    User::factory()->create(['name' => 'Bob Example', 'email' => 'bob@example.test']);

    $response = $this->actingAs($actor, 'web')
        ->getJson('/api/admin/users?search=alice&per_page=10');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.email', 'alice@example.test')
        ->assertJsonPath('meta.total', 1);
});

it('creates a user with multiple roles', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    Role::findOrCreate('support-agent', 'web');

    $response = $this->actingAs($actor, 'web')
        ->postJson('/api/admin/users', [
            'name' => 'Support User',
            'email' => 'support@example.test',
            'phone' => '+8801700000001',
            'email_verified' => true,
            'password' => 'secret-123',
            'password_confirmation' => 'secret-123',
            'status' => 'active',
            'roles' => ['admin', 'support-agent'],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.name', 'Support User')
        ->assertJsonPath('data.email', 'support@example.test')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.roles_count', 2);

    $user = User::query()->where('email', 'support@example.test')->firstOrFail();

    expect(Hash::check('secret-123', $user->password_hash))->toBeTrue()
        ->and($user->hasRole('admin'))->toBeTrue()
        ->and($user->hasRole('support-agent'))->toBeTrue();
});

it('updates a user and syncs roles', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    Role::findOrCreate('support-agent', 'web');
    $user = User::factory()->create([
        'name' => 'Old User',
        'email' => 'old@example.test',
        'phone' => '+8801700000002',
        'status' => 'active',
    ]);
    $user->assignRole('admin');

    $response = $this->actingAs($actor, 'web')
        ->patchJson("/api/admin/users/{$user->id}", [
            'name' => 'New User',
            'email' => 'new@example.test',
            'phone' => '+8801700000003',
            'email_verified' => false,
            'password' => 'secret-456',
            'password_confirmation' => 'secret-456',
            'status' => 'suspended',
            'roles' => ['support-agent'],
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.name', 'New User')
        ->assertJsonPath('data.email', 'new@example.test')
        ->assertJsonPath('data.status', 'suspended')
        ->assertJsonPath('data.roles_count', 1)
        ->assertJsonPath('data.roles.0.name', 'support-agent');

    $user->refresh();

    expect(Hash::check('secret-456', $user->password_hash))->toBeTrue()
        ->and($user->hasRole('support-agent'))->toBeTrue()
        ->and($user->hasRole('admin'))->toBeFalse();
});

it('creates a verification code when admin marks a user unverified', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    $user = User::factory()->create([
        'name' => 'Verified User',
        'email' => 'verified@example.test',
        'email_verified_at' => now(),
        'status' => 'active',
    ]);

    $this->actingAs($actor, 'web')
        ->patchJson("/api/admin/users/{$user->id}", [
            'name' => 'Verified User',
            'email' => 'verified@example.test',
            'phone' => null,
            'email_verified' => false,
            'password' => '',
            'password_confirmation' => '',
            'status' => 'active',
            'roles' => [],
        ])
        ->assertOk()
        ->assertJsonPath('data.email_verified_at', null);

    expect(AuthVerificationCode::query()
        ->where('user_id', $user->id)
        ->where('email', 'verified@example.test')
        ->where('purpose', 'email_verification')
        ->whereNull('consumed_at')
        ->exists())->toBeTrue();
});

it('validates user payloads', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->postJson('/api/admin/users', [
            'name' => '',
            'email' => 'not-an-email',
            'email_verified' => 'maybe',
            'password' => 'short',
            'password_confirmation' => 'different',
            'status' => 'paused',
            'roles' => ['missing-role'],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'email', 'email_verified', 'password', 'status', 'roles.0']);
});

it('deletes a user', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($actor, 'web')
        ->deleteJson("/api/admin/users/{$user->id}")
        ->assertNoContent();

    expect(User::query()->whereKey($user->id)->exists())->toBeFalse();
});

it('returns role options for user forms', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $actor = User::factory()->create();
    Role::findOrCreate('support-agent', 'web');

    $response = $this->actingAs($actor, 'web')
        ->getJson('/api/admin/roles/options');

    $response
        ->assertOk()
        ->assertJsonPath('data.0.name', 'admin')
        ->assertJsonPath('data.2.name', 'support-agent');
});
