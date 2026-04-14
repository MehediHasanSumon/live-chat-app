<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

it('returns paginated system logs for authenticated users', function () {
    $actor = User::factory()->create(['name' => 'Actor User']);
    Activity::query()->create([
        'log_name' => 'auth',
        'description' => 'User logged in.',
        'event' => 'logged_in',
        'causer_type' => User::class,
        'causer_id' => $actor->id,
        'properties' => ['ip' => '127.0.0.1'],
    ]);
    Activity::query()->create([
        'log_name' => 'auth',
        'description' => 'User logged out.',
        'event' => 'logged_out',
        'causer_type' => User::class,
        'causer_id' => $actor->id,
        'properties' => [],
    ]);

    $response = $this->actingAs($actor, 'web')
        ->getJson('/api/admin/system-logs?per_page=1');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.event', 'logged_out')
        ->assertJsonPath('data.0.causer_label', 'Actor User')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 1)
        ->assertJsonPath('meta.total', 2);
});

it('filters system logs by search on the server', function () {
    $actor = User::factory()->create();
    Activity::query()->create([
        'log_name' => 'auth',
        'description' => 'User logged in.',
        'event' => 'logged_in',
        'causer_type' => User::class,
        'causer_id' => $actor->id,
    ]);
    Activity::query()->create([
        'log_name' => 'storage',
        'description' => 'Cleanup executed.',
        'event' => 'cleanup_executed',
        'causer_type' => User::class,
        'causer_id' => $actor->id,
    ]);

    $response = $this->actingAs($actor, 'web')
        ->getJson('/api/admin/system-logs?search=cleanup&per_page=10');

    $response
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.log_name', 'storage')
        ->assertJsonPath('data.0.event', 'cleanup_executed')
        ->assertJsonPath('meta.total', 1);
});
