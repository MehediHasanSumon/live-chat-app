<?php

use App\Models\CompanySetting;
use App\Models\StorageObject;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('updates existing user settings using user id as the primary key', function () {
    $user = User::factory()->create();

    UserSetting::query()->create([
        'user_id' => $user->id,
        'theme' => 'system',
        'show_active_status' => true,
        'allow_message_requests' => true,
        'push_enabled' => true,
        'sound_enabled' => true,
        'vibrate_enabled' => true,
        'quiet_hours_enabled' => false,
        'quiet_hours_timezone' => 'Asia/Dhaka',
    ]);

    $response = $this->actingAs($user, 'web')->patchJson('/api/settings/quiet-hours', [
        'quiet_hours_enabled' => true,
        'quiet_hours_start' => '22:00',
        'quiet_hours_end' => '07:00',
        'quiet_hours_timezone' => 'Asia/Dhaka',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.quiet_hours_enabled', true)
        ->assertJsonPath('data.quiet_hours_start', '22:00')
        ->assertJsonPath('data.quiet_hours_end', '07:00');

    $settings = UserSetting::query()->where('user_id', $user->id)->first();

    expect($settings)->not->toBeNull()
        ->and($settings?->quiet_hours_enabled)->toBeTrue()
        ->and(substr((string) $settings?->quiet_hours_start, 0, 5))->toBe('22:00')
        ->and(substr((string) $settings?->quiet_hours_end, 0, 5))->toBe('07:00');
});

it('updates the authenticated user profile and avatar', function () {
    Storage::fake(config('uploads.disk'));

    $user = User::factory()->create([
        'name' => 'Old Name',
        'username' => 'old-user',
        'email' => 'old@example.com',
        'phone' => '01700000000',
    ]);

    $this->actingAs($user, 'web')
        ->post('/api/uploads', [
            'file' => UploadedFile::fake()->image('avatar.png', 300, 300),
            'purpose' => 'user_avatar',
        ])
        ->assertCreated();

    $avatar = StorageObject::query()->firstOrFail();

    $response = $this->actingAs($user, 'web')
        ->patchJson('/api/settings/profile', [
            'name' => 'New Name',
            'username' => 'new-user',
            'email' => 'new@example.com',
            'phone' => '01800000000',
            'avatar_object_id' => $avatar->id,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.name', 'New Name')
        ->assertJsonPath('data.user.username', 'new-user')
        ->assertJsonPath('data.user.email', 'new@example.com')
        ->assertJsonPath('data.user.phone', '01800000000')
        ->assertJsonPath('data.user.avatar_object_id', $avatar->id)
        ->assertJsonPath('data.user.avatar_object.id', $avatar->id);

    expect($user->fresh())
        ->name->toBe('New Name')
        ->username->toBe('new-user')
        ->email->toBe('new@example.com')
        ->phone->toBe('01800000000')
        ->avatar_object_id->toBe($avatar->id);
});

it('removes the authenticated user avatar and permanently deletes the storage object', function () {
    Storage::fake(config('uploads.disk'));

    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->post('/api/uploads', [
            'file' => UploadedFile::fake()->image('avatar.png', 300, 300),
            'purpose' => 'user_avatar',
        ])
        ->assertCreated();

    $avatar = StorageObject::query()->firstOrFail();

    $user->forceFill([
        'avatar_object_id' => $avatar->id,
    ])->save();

    Storage::disk(config('uploads.disk'))->assertExists($avatar->disk_path);

    $response = $this->actingAs($user, 'web')
        ->deleteJson("/api/settings/avatar/{$avatar->id}");

    $response
        ->assertOk()
        ->assertJsonPath('data.user.avatar_object_id', null)
        ->assertJsonPath('data.user.avatar_object', null);

    expect($user->fresh()->avatar_object_id)->toBeNull();
    expect(StorageObject::query()->find($avatar->id))->toBeNull();
    Storage::disk(config('uploads.disk'))->assertMissing($avatar->disk_path);
});

it('marks email unverified and issues a verification code after email change when verification is required', function () {
    CompanySetting::query()->create([
        'company_name' => 'Nexus',
        'currency' => 'BDT',
        'status' => 'active',
        'is_registration_enable' => true,
        'is_email_verification_enable' => true,
        'updated_at' => now(),
    ]);

    $user = User::factory()->create([
        'name' => 'Alex',
        'username' => 'alex',
        'email' => 'alex@example.com',
        'email_verified_at' => now(),
    ]);

    $response = $this->actingAs($user, 'web')
        ->patchJson('/api/settings/profile', [
            'name' => 'Alex',
            'username' => 'alex',
            'email' => 'alex+new@example.com',
            'phone' => null,
            'avatar_object_id' => null,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.email', 'alex+new@example.com')
        ->assertJsonPath('data.user.email_verified_at', null)
        ->assertJsonPath('data.must_verify_email', true);

    expect($user->fresh()->email_verified_at)->toBeNull();

    $this->assertDatabaseHas('auth_verification_codes', [
        'user_id' => $user->id,
        'email' => 'alex+new@example.com',
        'purpose' => 'email_verification',
    ]);
});

it('updates the authenticated user password after confirming the current password', function () {
    $user = User::factory()->create([
        'password_hash' => 'old-secret-123',
    ]);

    $this->actingAs($user, 'web')
        ->patchJson('/api/settings/password', [
            'current_password' => 'wrong-secret',
            'password' => 'new-secret-123',
            'password_confirmation' => 'new-secret-123',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.current_password.0', 'The current password is incorrect.');

    $response = $this->actingAs($user, 'web')
        ->patchJson('/api/settings/password', [
            'current_password' => 'old-secret-123',
            'password' => 'new-secret-123',
            'password_confirmation' => 'new-secret-123',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('message', 'Password updated successfully.');

    expect(Hash::check('new-secret-123', (string) $user->fresh()->password_hash))->toBeTrue();
});
