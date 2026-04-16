<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\UpdateAccountPasswordRequest;
use App\Http\Requests\Settings\UpdateAccountProfileRequest;
use App\Http\Requests\Settings\UpdateNotificationSettingsRequest;
use App\Http\Requests\Settings\UpdatePresenceSettingsRequest;
use App\Http\Requests\Settings\UpdateQuietHoursRequest;
use App\Http\Requests\Settings\UpdateThemeRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\StorageObject;
use App\Http\Resources\UserSettingResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use App\Services\Auth\VerificationCodeService;
use Illuminate\Support\Facades\Hash;

class SettingsController extends Controller
{
    public function __construct(
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    public function profile(UpdateAccountProfileRequest $request): AuthenticatedUserResource
    {
        $user = $request->user();
        $validated = $request->validated();
        $email = filled($validated['email'] ?? null) ? trim((string) $validated['email']) : null;
        $emailChanged = $email !== $user->email;
        $avatarObjectId = array_key_exists('avatar_object_id', $validated)
            ? ($validated['avatar_object_id'] !== null ? (int) $validated['avatar_object_id'] : null)
            : $user->avatar_object_id;

        if ($avatarObjectId !== null) {
            $this->assertValidAvatarObject($avatarObjectId, (int) $user->getKey());
        }

        $user->forceFill([
            'name' => trim((string) $validated['name']),
            'username' => trim((string) $validated['username']),
            'email' => $email,
            'phone' => filled($validated['phone'] ?? null) ? trim((string) $validated['phone']) : null,
            'avatar_object_id' => $avatarObjectId,
            'email_verified_at' => $emailChanged
                ? ($email && ! $this->verificationCodes->emailVerificationRequired() ? now() : null)
                : $user->email_verified_at,
        ])->save();

        if ($emailChanged && $this->verificationCodes->userMustVerifyEmail($user)) {
            $this->verificationCodes->sendEmailVerificationCode($user);
        }

        return new AuthenticatedUserResource($user->fresh(['settings', 'avatarObject']));
    }

    public function password(UpdateAccountPasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check((string) $request->input('current_password'), $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password_hash' => (string) $request->input('password'),
        ])->save();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

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

    protected function assertValidAvatarObject(int $avatarObjectId, int $userId): void
    {
        $storageObject = StorageObject::query()->find($avatarObjectId);

        if (! $storageObject) {
            throw ValidationException::withMessages([
                'avatar_object_id' => ['The selected avatar is invalid.'],
            ]);
        }

        if ((int) $storageObject->owner_user_id !== $userId) {
            throw ValidationException::withMessages([
                'avatar_object_id' => ['You may only use avatar uploads that you uploaded.'],
            ]);
        }

        if ($storageObject->purpose !== 'user_avatar') {
            throw ValidationException::withMessages([
                'avatar_object_id' => ['Only user avatar uploads can be used as a profile photo.'],
            ]);
        }

        if ($storageObject->deleted_at !== null) {
            throw ValidationException::withMessages([
                'avatar_object_id' => ['This uploaded avatar is no longer available.'],
            ]);
        }
    }
}
