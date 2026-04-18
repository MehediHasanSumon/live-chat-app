<?php

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

it('logs in a mobile user with a personal access token', function () {
    $user = User::factory()->create([
        'username' => 'sumon',
        'password_hash' => Hash::make('secret-123'),
    ]);

    $response = $this->postJson('/api/mobile/login', [
        'login' => 'sumon',
        'password' => 'secret-123',
        'device_name' => 'Pixel 8 Pro',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('token_type', 'Bearer')
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.username', 'sumon')
        ->assertJsonPath('data.settings.theme', 'system');

    $token = $response->json('token');
    $activity = Activity::query()->latest('id')->first();

    expect($token)->toBeString()
        ->and($token)->not->toBe('')
        ->and(UserSetting::query()->where('user_id', $user->id)->exists())->toBeTrue()
        ->and(PersonalAccessToken::query()->where('tokenable_id', $user->id)->count())->toBe(1)
        ->and($activity)->not->toBeNull()
        ->and($activity?->event)->toBe('mobile_logged_in')
        ->and($activity?->description)->toBe('User logged in from mobile app.')
        ->and($activity?->getExtraProperty('device_name'))->toBe('Pixel 8 Pro')
        ->and($activity?->getExtraProperty('auth_mode'))->toBe('mobile_token');

    $this->assertGuest('web');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id);
});

it('rejects invalid mobile login credentials', function () {
    User::factory()->create([
        'username' => 'sumon',
        'password_hash' => Hash::make('secret-123'),
    ]);

    $this->postJson('/api/mobile/login', [
        'login' => 'sumon',
        'password' => 'wrong-password',
        'device_name' => 'Pixel 8 Pro',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['login']);

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('rejects suspended users from mobile login', function () {
    User::factory()->create([
        'username' => 'sumon',
        'status' => 'suspended',
        'password_hash' => Hash::make('secret-123'),
    ]);

    $this->postJson('/api/mobile/login', [
        'login' => 'sumon',
        'password' => 'secret-123',
        'device_name' => 'Pixel 8 Pro',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['login']);

    expect(PersonalAccessToken::query()->count())->toBe(0);
});
