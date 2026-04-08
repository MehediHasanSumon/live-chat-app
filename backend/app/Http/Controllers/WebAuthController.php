<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\WebLoginRequest;
use App\Http\Requests\Auth\WebRegisterRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class WebAuthController extends Controller
{
    public function register(WebRegisterRequest $request): JsonResponse
    {
        $user = User::query()->create([
            'username' => $request->string('username')->toString(),
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString() ?: null,
            'phone' => $request->string('phone')->toString() ?: null,
            'password_hash' => $request->string('password')->toString(),
            'status' => 'active',
            'last_seen_at' => now(),
        ]);

        UserSetting::query()->create([
            'user_id' => $user->getKey(),
            'updated_at' => now(),
        ]);

        Auth::guard('web')->login($user);

        $request->session()->regenerate();

        return response()->json([
            'data' => (new AuthenticatedUserResource($user->fresh(['settings'])))->resolve(),
        ], 201);
    }

    public function login(WebLoginRequest $request): AuthenticatedUserResource
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

        Auth::guard('web')->login($user, $request->remember());

        $request->session()->regenerate();

        $user->forceFill([
            'last_seen_at' => now(),
        ])->save();

        return new AuthenticatedUserResource($user->fresh(['settings']));
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
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
}
