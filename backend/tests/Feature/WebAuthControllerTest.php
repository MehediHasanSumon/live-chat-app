<?php

use App\Models\AuthVerificationCode;
use App\Models\CompanySetting;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

function enablePublicRegistration(array $overrides = []): void
{
    CompanySetting::query()->create([
        'company_name' => 'Nexus',
        'is_registration_enable' => true,
        'is_email_verification_enable' => false,
        'status' => 'active',
        ...$overrides,
    ]);
}

it('registers a web user and creates default settings', function () {
    enablePublicRegistration();

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
    $activity = Activity::query()->latest('id')->first();

    $this->assertAuthenticatedAs($user, 'web');

    expect(UserSetting::query()->where('user_id', $user->id)->exists())->toBeTrue()
        ->and($activity)->not->toBeNull()
        ->and($activity?->log_name)->toBe('auth')
        ->and($activity?->event)->toBe('registered')
        ->and($activity?->description)->toBe('User registered.')
        ->and((int) $activity?->causer_id)->toBe($user->id)
        ->and($activity?->getExtraProperty('username'))->toBe('sumon');
});

it('returns public company settings with fallback defaults when no active setting exists', function () {
    $this->getJson('/api/public/company-settings')
        ->assertOk()
        ->assertJsonPath('data.company_name', 'Nexus')
        ->assertJsonPath('data.is_registration_enable', false)
        ->assertJsonPath('data.is_email_verification_enable', true)
        ->assertJsonPath('data.company_logo_object', null);
});

it('rejects duplicate register credentials', function () {
    enablePublicRegistration();

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

    $activity = Activity::query()->latest('id')->first();

    $this->assertAuthenticatedAs($user, 'web');

    expect(UserSetting::query()->where('user_id', $user->id)->exists())->toBeTrue()
        ->and($activity)->not->toBeNull()
        ->and($activity?->log_name)->toBe('auth')
        ->and($activity?->event)->toBe('logged_in')
        ->and($activity?->description)->toBe('User logged in.')
        ->and((int) $activity?->causer_id)->toBe($user->id)
        ->and($activity?->getExtraProperty('remember'))->toBeFalse();
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
    enablePublicRegistration();

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

    $activity = Activity::query()->latest('id')->first();

    expect($activity)->not->toBeNull()
        ->and($activity?->log_name)->toBe('auth')
        ->and($activity?->event)->toBe('logged_out')
        ->and($activity?->description)->toBe('User logged out.')
        ->and((int) $activity?->causer_id)->toBe($user->id);
});

it('sends a forgot password code without revealing account existence', function () {
    User::factory()->create([
        'email' => 'sumon@example.com',
        'status' => 'active',
    ]);

    $response = $this->postJson('/forgot-password', [
        'email' => 'sumon@example.com',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('message', 'If an active account exists for that email, a reset code has been sent.');

    expect(AuthVerificationCode::query()
        ->where('email', 'sumon@example.com')
        ->where('purpose', 'password_reset')
        ->whereNull('consumed_at')
        ->exists())->toBeTrue();

    $this->postJson('/forgot-password', [
        'email' => 'missing@example.com',
    ])->assertOk();
});

it('resets a password with a valid six digit code', function () {
    $user = User::factory()->create([
        'email' => 'sumon@example.com',
        'password_hash' => Hash::make('old-secret-123'),
    ]);
    $verificationCode = AuthVerificationCode::query()->create([
        'user_id' => $user->id,
        'email' => 'sumon@example.com',
        'purpose' => 'password_reset',
        'code_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->postJson('/reset-password', [
        'email' => 'sumon@example.com',
        'code' => '123456',
        'password' => 'new-secret-123',
        'password_confirmation' => 'new-secret-123',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('message', 'Password reset successfully.');

    expect(Hash::check('new-secret-123', $user->fresh()->password_hash))->toBeTrue()
        ->and($verificationCode->fresh()->consumed_at)->not->toBeNull();
});

it('verifies a password reset code without consuming it', function () {
    $user = User::factory()->create([
        'email' => 'sumon@example.com',
        'status' => 'active',
    ]);
    $verificationCode = AuthVerificationCode::query()->create([
        'user_id' => $user->id,
        'email' => 'sumon@example.com',
        'purpose' => 'password_reset',
        'code_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->postJson('/reset-password/verify-code', [
        'email' => 'sumon@example.com',
        'code' => '123456',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('message', 'Verification code accepted.');

    expect($verificationCode->fresh()->consumed_at)->toBeNull();
});

it('rejects invalid reset codes', function () {
    $user = User::factory()->create([
        'email' => 'sumon@example.com',
    ]);
    AuthVerificationCode::query()->create([
        'user_id' => $user->id,
        'email' => 'sumon@example.com',
        'purpose' => 'password_reset',
        'code_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->postJson('/reset-password', [
        'email' => 'sumon@example.com',
        'code' => '654321',
        'password' => 'new-secret-123',
        'password_confirmation' => 'new-secret-123',
    ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['code']);
});

it('requires email on registration when email verification is enabled', function () {
    enablePublicRegistration([
        'is_email_verification_enable' => true,
    ]);

    $response = $this->postJson('/register', [
        'username' => 'sumon-no-email',
        'name' => 'Sumon Hasan',
        'password' => 'secret-123',
        'password_confirmation' => 'secret-123',
    ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

it('blocks registration when public registration is disabled', function () {
    $response = $this->postJson('/register', [
        'username' => 'sumon-disabled',
        'name' => 'Sumon Hasan',
        'email' => 'sumon-disabled@example.com',
        'password' => 'secret-123',
        'password_confirmation' => 'secret-123',
    ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['register']);

    expect(User::query()->where('username', 'sumon-disabled')->exists())->toBeFalse();
});

it('verifies an authenticated user email with a six digit code', function () {
    enablePublicRegistration([
        'is_email_verification_enable' => true,
    ]);
    $user = User::factory()->unverified()->create([
        'email' => 'sumon@example.com',
    ]);
    $verificationCode = AuthVerificationCode::query()->create([
        'user_id' => $user->id,
        'email' => 'sumon@example.com',
        'purpose' => 'email_verification',
        'code_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($user, 'web')
        ->postJson('/email/verification/verify', [
            'code' => '123456',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.email_verified_at', fn ($value) => filled($value))
        ->assertJsonPath('data.must_verify_email', false);

    expect($user->fresh()->email_verified_at)->not->toBeNull()
        ->and($verificationCode->fresh()->consumed_at)->not->toBeNull();
});

it('blocks protected api routes until email is verified', function () {
    enablePublicRegistration([
        'is_email_verification_enable' => true,
    ]);
    $user = User::factory()->unverified()->create([
        'email' => 'sumon@example.com',
    ]);

    $this->actingAs($user, 'web')
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.must_verify_email', true);

    $this->actingAs($user, 'web')
        ->getJson('/api/conversations')
        ->assertForbidden()
        ->assertJsonPath('email_verification_required', true);
});

it('forces verification for any authenticated user whose email is marked unverified', function () {
    $user = User::factory()->unverified()->create([
        'email' => 'sumon@example.com',
    ]);

    $this->actingAs($user, 'web')
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.must_verify_email', true);

    $this->actingAs($user, 'web')
        ->getJson('/api/conversations')
        ->assertForbidden()
        ->assertJsonPath('email_verification_required', true);
});
