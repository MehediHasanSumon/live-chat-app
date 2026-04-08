<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\UpdateNotificationSettingsRequest;
use App\Http\Requests\Settings\UpdatePresenceSettingsRequest;
use App\Http\Requests\Settings\UpdateQuietHoursRequest;
use App\Http\Requests\Settings\UpdateThemeRequest;
use App\Http\Resources\UserSettingResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function theme(UpdateThemeRequest $request): JsonResponse
    {
        $settings = $this->settingsFor($request);
        $settings->forceFill([
            'theme' => $request->string('theme')->toString(),
            'updated_at' => now(),
        ])->save();

        return response()->json([
            'data' => (new UserSettingResource($settings))->resolve($request),
        ]);
    }

    public function presence(UpdatePresenceSettingsRequest $request): JsonResponse
    {
        $settings = $this->settingsFor($request);
        $settings->forceFill([
            'show_active_status' => $request->boolean('show_active_status'),
            'allow_message_requests' => $request->boolean('allow_message_requests'),
            'updated_at' => now(),
        ])->save();

        return response()->json([
            'data' => (new UserSettingResource($settings))->resolve($request),
        ]);
    }

    public function notifications(UpdateNotificationSettingsRequest $request): JsonResponse
    {
        $settings = $this->settingsFor($request);
        $settings->forceFill([
            'push_enabled' => $request->boolean('push_enabled'),
            'sound_enabled' => $request->boolean('sound_enabled'),
            'vibrate_enabled' => $request->boolean('vibrate_enabled'),
            'updated_at' => now(),
        ])->save();

        return response()->json([
            'data' => (new UserSettingResource($settings))->resolve($request),
        ]);
    }

    public function quietHours(UpdateQuietHoursRequest $request): JsonResponse
    {
        $settings = $this->settingsFor($request);
        $settings->forceFill([
            'quiet_hours_enabled' => $request->boolean('quiet_hours_enabled'),
            'quiet_hours_start' => $request->input('quiet_hours_start'),
            'quiet_hours_end' => $request->input('quiet_hours_end'),
            'quiet_hours_timezone' => $request->input('quiet_hours_timezone', $settings->quiet_hours_timezone ?? 'Asia/Dhaka'),
            'updated_at' => now(),
        ])->save();

        return response()->json([
            'data' => (new UserSettingResource($settings))->resolve($request),
        ]);
    }

    protected function settingsFor(Request $request)
    {
        return $request->user()->settings()->firstOrCreate([], [
            'theme' => 'system',
            'show_active_status' => true,
            'allow_message_requests' => true,
            'push_enabled' => true,
            'sound_enabled' => true,
            'vibrate_enabled' => true,
            'quiet_hours_enabled' => false,
            'quiet_hours_timezone' => 'Asia/Dhaka',
            'updated_at' => now(),
        ]);
    }
}
