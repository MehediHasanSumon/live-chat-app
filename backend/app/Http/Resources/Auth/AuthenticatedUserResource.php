<?php

namespace App\Http\Resources\Auth;

use App\Http\Resources\UserResource;
use App\Http\Resources\UserSettingResource;
use App\Services\Auth\VerificationCodeService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthenticatedUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(['settings', 'avatarObject', 'roles', 'permissions']);
        $verificationCodes = app(VerificationCodeService::class);

        return [
            'user' => (new UserResource($this->resource))->resolve($request),
            'settings' => $this->settings
                ? (new UserSettingResource($this->settings))->resolve($request)
                : null,
            'email_verification_required' => $verificationCodes->emailVerificationRequired(),
            'must_verify_email' => $verificationCodes->userMustVerifyEmail($this->resource),
        ];
    }
}
