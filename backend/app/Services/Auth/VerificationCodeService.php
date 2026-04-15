<?php

namespace App\Services\Auth;

use App\Models\AuthVerificationCode;
use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class VerificationCodeService
{
    public const PURPOSE_PASSWORD_RESET = 'password_reset';

    public const PURPOSE_EMAIL_VERIFICATION = 'email_verification';

    private const CODE_TTL_MINUTES = 10;

    private const MAX_ATTEMPTS = 5;

    public function emailVerificationRequired(): bool
    {
        return CompanySetting::query()
            ->where('status', 'active')
            ->where('is_email_verification_enable', true)
            ->exists();
    }

    public function userMustVerifyEmail(?User $user): bool
    {
        return $this->emailVerificationRequired()
            && $user !== null
            && filled($user->email)
            && $user->email_verified_at === null;
    }

    public function sendPasswordResetCodeIfUserExists(string $email): void
    {
        $user = User::query()
            ->where('email', $email)
            ->where('status', 'active')
            ->first();

        if (! $user) {
            return;
        }

        $this->createAndSendCode(
            email: $email,
            purpose: self::PURPOSE_PASSWORD_RESET,
            subject: 'Your password reset code',
            user: $user
        );
    }

    public function sendEmailVerificationCode(User $user): void
    {
        if (! $user->email) {
            $this->throwCodeValidationException('email', 'An email address is required before verification.');
        }

        $this->createAndSendCode(
            email: $user->email,
            purpose: self::PURPOSE_EMAIL_VERIFICATION,
            subject: 'Your email verification code',
            user: $user
        );
    }

    public function consumePasswordResetCode(string $email, string $code): AuthVerificationCode
    {
        return $this->validateCode($email, self::PURPOSE_PASSWORD_RESET, $code, consume: true);
    }

    public function verifyPasswordResetCode(string $email, string $code): AuthVerificationCode
    {
        return $this->validateCode($email, self::PURPOSE_PASSWORD_RESET, $code);
    }

    public function consumeEmailVerificationCode(User $user, string $code): AuthVerificationCode
    {
        if (! $user->email) {
            $this->throwCodeValidationException('email', 'An email address is required before verification.');
        }

        return $this->validateCode($user->email, self::PURPOSE_EMAIL_VERIFICATION, $code, $user, consume: true);
    }

    private function createAndSendCode(string $email, string $purpose, string $subject, User $user): void
    {
        AuthVerificationCode::query()
            ->where('email', $email)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $code = (string) random_int(100000, 999999);

        AuthVerificationCode::query()->create([
            'user_id' => $user->getKey(),
            'email' => $email,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
        ]);

        $body = "Your {$this->purposeLabel($purpose)} code is {$code}. It will expire in ".self::CODE_TTL_MINUTES.' minutes.';

        Mail::raw($body, function (Message $message) use ($email, $subject): void {
            $message->to($email)->subject($subject);
        });
    }

    private function validateCode(
        string $email,
        string $purpose,
        string $code,
        ?User $user = null,
        bool $consume = false
    ): AuthVerificationCode
    {
        $query = AuthVerificationCode::query()
            ->where('email', $email)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->where('attempts', '<', self::MAX_ATTEMPTS);

        if ($user) {
            $query->where('user_id', $user->getKey());
        }

        /** @var AuthVerificationCode|null $verificationCode */
        $verificationCode = $query->latest('id')->first();

        if (! $verificationCode) {
            $this->throwCodeValidationException('code', 'The verification code is invalid or expired.');
        }

        if (! Hash::check($code, $verificationCode->code_hash)) {
            $verificationCode->increment('attempts');
            $this->throwCodeValidationException('code', 'The verification code is invalid or expired.');
        }

        if ($consume) {
            $verificationCode->forceFill([
                'consumed_at' => now(),
            ])->save();
        }

        return $verificationCode;
    }

    private function purposeLabel(string $purpose): string
    {
        return $purpose === self::PURPOSE_PASSWORD_RESET
            ? 'password reset'
            : 'email verification';
    }

    private function throwCodeValidationException(string $field, string $message): never
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
