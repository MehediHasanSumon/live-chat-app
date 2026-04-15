<?php

use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;

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
