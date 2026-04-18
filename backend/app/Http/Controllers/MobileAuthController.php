<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\MobileLoginRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MobileAuthController extends Controller
{
    public function login(MobileLoginRequest $request): JsonResponse
    {
        $user = User::query()
            ->where(function ($query) use ($request): void {
                $query
                    ->where('username', $request->login())
                    ->orWhere('email', $request->login())
                    ->orWhere('phone', $request->login());
            })
            ->first();

        if (! $user || ! Hash::check($request->password(), $user->password_hash)) {
            $this->throwJsonValidationException('login', 'The provided credentials are incorrect.');
        }

        if ($user->status !== 'active') {
            $this->throwJsonValidationException('login', 'This account is not allowed to sign in.');
        }

        UserSetting::query()->firstOrCreate(
            ['user_id' => $user->getKey()],
            ['updated_at' => now()]
        );

        $user->forceFill([
            'last_seen_at' => now(),
        ])->save();

        $token = $user->createToken($request->deviceName(), ['mobile'])->plainTextToken;

        $this->logAuthActivity($request, $user, 'mobile_logged_in', 'User logged in from mobile app.', [
            'device_name' => $request->deviceName(),
            'auth_mode' => 'mobile_token',
        ]);

        return response()->json([
            'token_type' => 'Bearer',
            'token' => $token,
            'data' => (new AuthenticatedUserResource($user->fresh(['settings'])))->resolve(),
        ]);
    }

    protected function throwJsonValidationException(string $field, string $message): never
    {
        $exception = ValidationException::withMessages([
            $field => [$message],
        ]);

        $exception->response = response()->json([
            'message' => 'The given data was invalid.',
            'errors' => [
                $field => [$message],
            ],
        ], 422);

        throw $exception;
    }

    protected function logAuthActivity(Request $request, User $user, string $event, string $description, array $properties = []): void
    {
        activity('auth')
            ->performedOn($user)
            ->causedBy($user)
            ->event($event)
            ->withProperties([
                'username' => $user->username,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                ...$properties,
            ])
            ->log($description);
    }
}
