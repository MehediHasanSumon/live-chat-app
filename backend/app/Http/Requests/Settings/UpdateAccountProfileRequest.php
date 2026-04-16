<?php

namespace App\Http\Requests\Settings;

use App\Services\Auth\VerificationCodeService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAccountProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->user()?->getKey();
        $emailVerificationRequired = app(VerificationCodeService::class)->emailVerificationRequired();

        return [
            'name' => ['required', 'string', 'max:80'],
            'username' => ['required', 'string', 'min:3', 'max:32', Rule::unique('users', 'username')->ignore($userId)],
            'email' => [$emailVerificationRequired ? 'required' : 'nullable', 'email', 'max:120', Rule::unique('users', 'email')->ignore($userId)],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($userId)],
            'avatar_object_id' => ['nullable', 'integer', 'exists:storage_objects,id'],
        ];
    }
}
