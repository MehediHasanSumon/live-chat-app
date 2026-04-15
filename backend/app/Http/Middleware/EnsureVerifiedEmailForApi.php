<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Auth\VerificationCodeService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureVerifiedEmailForApi
{
    public function __construct(private readonly VerificationCodeService $verificationCodes) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/me') || $request->is('api/user')) {
            return $next($request);
        }

        /** @var User|null $user */
        $user = $request->user();

        if ($this->verificationCodes->userMustVerifyEmail($user)) {
            return response()->json([
                'message' => 'Email verification is required.',
                'email_verification_required' => true,
            ], 403);
        }

        return $next($request);
    }
}
