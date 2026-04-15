<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\WebLoginRequest;
use App\Http\Requests\Auth\WebRegisterRequest;
use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\User;
use App\Models\UserSetting;
use App\Services\Auth\VerificationCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class WebAuthController extends Controller
{
    public function __construct(private readonly VerificationCodeService $verificationCodes) {}

    public function register(WebRegisterRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString() ?: null;
        $verificationRequired = $this->verificationCodes->emailVerificationRequired();

        if ($verificationRequired && ! $email) {
            $this->throwJsonValidationException('email', 'Email is required when email verification is enabled.');
        }

        $user = User::query()->create([
            'username' => $request->string('username')->toString(),
            'name' => $request->string('name')->toString(),
            'email' => $email,
            'email_verified_at' => $email && ! $verificationRequired ? now() : null,
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
        $this->logAuthActivity($request, $user, 'registered', 'User registered.');

        if ($this->verificationCodes->userMustVerifyEmail($user)) {
            $this->verificationCodes->sendEmailVerificationCode($user);
        }

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
        $this->logAuthActivity($request, $user, 'logged_in', 'User logged in.', [
            'remember' => $request->remember(),
        ]);

        return new AuthenticatedUserResource($user->fresh(['settings']));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:120'],
        ]);

        $this->verificationCodes->sendPasswordResetCodeIfUserExists(trim((string) $validated['email']));

        return response()->json([
            'message' => 'If an active account exists for that email, a reset code has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $email = trim((string) $validated['email']);
        $user = User::query()
            ->where('email', $email)
            ->where('status', 'active')
            ->first();

        if (! $user) {
            $this->throwJsonValidationException('code', 'The verification code is invalid or expired.');
        }

        $this->verificationCodes->consumePasswordResetCode($email, (string) $validated['code']);

        $user->forceFill([
            'password_hash' => (string) $validated['password'],
        ])->save();

        $this->logAuthActivity($request, $user, 'password_reset', 'User reset password with email code.');

        return response()->json([
            'message' => 'Password reset successfully.',
        ]);
    }

    public function sendEmailVerification(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('web');

        if ($user->email_verified_at !== null) {
            return response()->json([
                'message' => 'Email is already verified.',
            ]);
        }

        $this->verificationCodes->sendEmailVerificationCode($user);

        return response()->json([
            'message' => 'Verification code sent.',
        ]);
    }

    public function verifyEmail(Request $request): AuthenticatedUserResource
    {
        $validated = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        /** @var User $user */
        $user = $request->user('web');

        if ($user->email_verified_at === null) {
            $this->verificationCodes->consumeEmailVerificationCode($user, (string) $validated['code']);

            $user->forceFill([
                'email_verified_at' => now(),
            ])->save();

            $this->logAuthActivity($request, $user, 'email_verified', 'User verified email with code.');
        }

        return new AuthenticatedUserResource($user->fresh(['settings']));
    }

    public function logout(Request $request): Response
    {
        /** @var User|null $user */
        $user = $request->user('web');

        if ($user) {
            $this->logAuthActivity($request, $user, 'logged_out', 'User logged out.');
        }

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
