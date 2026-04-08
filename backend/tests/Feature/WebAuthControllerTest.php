<?php

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('registers a web user and creates default settings', function () {
    $response = $this->postJson('/register', [
        'username' => 'sumon',
        'name' => 'Sumon Hasan',
        'email' => 'sumon@example.com',
        'phone' => '+8801700000000',
        'password' => 'secret-123',
        'password_confirmation' => 'secret-123',
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.user.username', 'sumon')
        ->assertJsonPath('data.user.email', 'sumon@example.com')
        ->assertJsonPath('data.settings.theme', 'system');

    $user = User::query()->where('username', 'sumon')->firstOrFail();

    $this->assertAuthenticatedAs($user, 'web');

    expect(UserSetting::query()->where('user_id', $user->id)->exists())->toBeTrue();
});

it('rejects duplicate register credentials', function () {
    User::factory()->create([
        'username' => 'sumon',
        'email' => 'sumon@example.com',
    ]);

    $response = $this->postJson('/register', [
        'username' => 'sumon',
        'name' => 'Another Sumon',
        'email' => 'sumon@example.com',
        'password' => 'secret-123',
        'password_confirmation' => 'secret-123',
    ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['username', 'email']);
});

it('logs in a web user with username credentials', function () {
    $user = User::factory()->create([
        'username' => 'sumon',
        'password_hash' => Hash::make('secret-123'),
    ]);

    $response = $this->post('/login', [
        'login' => 'sumon',
        'password' => 'secret-123',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.username', 'sumon')
        ->assertJsonPath('data.settings.theme', 'system');

    $this->assertAuthenticatedAs($user, 'web');

    expect(UserSetting::query()->where('user_id', $user->id)->exists())->toBeTrue();
});

it('rejects invalid web login credentials', function () {
    User::factory()->create([
        'username' => 'sumon',
        'password_hash' => Hash::make('secret-123'),
    ]);

    $response = $this->post('/login', [
        'login' => 'sumon',
        'password' => 'wrong-password',
    ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['login']);

    $this->assertGuest('web');
});

it('rate limits repeated login attempts', function () {
    User::factory()->create([
        'username' => 'sumon',
        'password_hash' => Hash::make('secret-123'),
    ]);

    foreach (range(1, 5) as $attempt) {
        $response = $this->post('/login', [
            'login' => 'sumon',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
    }

    $this->post('/login', [
        'login' => 'sumon',
        'password' => 'wrong-password',
    ])->assertTooManyRequests();
});

it('rate limits repeated register attempts', function () {
    foreach (range(1, 3) as $attempt) {
        $response = $this->postJson('/register', [
            'username' => 'sumon-rate-limit',
            'name' => 'Sumon Hasan',
            'email' => "sumon-rate-limit-{$attempt}@example.com",
            'password' => 'secret-123',
            'password_confirmation' => 'mismatch-secret',
        ]);

        $response->assertUnprocessable();
    }

    $this->postJson('/register', [
        'username' => 'sumon-rate-limit',
        'name' => 'Sumon Hasan',
        'email' => 'sumon-rate-limit-4@example.com',
        'password' => 'secret-123',
        'password_confirmation' => 'mismatch-secret',
    ])->assertTooManyRequests();
});

it('returns the authenticated web user from api me', function () {
    $user = User::factory()->create();
    UserSetting::query()->create([
        'user_id' => $user->id,
        'theme' => 'dark',
        'updated_at' => now(),
    ]);

    $response = $this
        ->actingAs($user, 'web')
        ->getJson('/api/me');

    $response
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.settings.theme', 'dark');
});

it('logs out the authenticated web user', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user, 'web')
        ->post('/logout');

    $response->assertNoContent();

    $this->assertGuest('web');
});
