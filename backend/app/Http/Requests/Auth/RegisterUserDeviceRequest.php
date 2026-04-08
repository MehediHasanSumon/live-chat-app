<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Auth\Concerns\ReturnsJsonValidationErrors;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterUserDeviceRequest extends FormRequest
{
    use ReturnsJsonValidationErrors;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, \Illuminate\Contracts\Validation\ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'device_uuid' => ['required', 'string', 'max:80'],
            'platform' => ['required', 'string', Rule::in(['web', 'android', 'ios'])],
            'device_name' => ['required', 'string', 'max:120'],
            'push_provider' => ['sometimes', 'string', Rule::in(['fcm', 'apns', 'webpush', 'none'])],
            'push_token' => ['nullable', 'string'],
            'app_version' => ['nullable', 'string', 'max:32'],
            'build_number' => ['nullable', 'string', 'max:32'],
            'locale' => ['nullable', 'string', 'max:16'],
            'timezone' => ['nullable', 'string', 'max:64'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'device_uuid' => trim((string) $this->input('device_uuid')),
            'platform' => trim((string) $this->input('platform')),
            'device_name' => trim((string) $this->input('device_name')),
            'push_provider' => $this->filled('push_provider')
                ? trim((string) $this->input('push_provider'))
                : 'none',
            'push_token' => $this->filled('push_token') ? trim((string) $this->input('push_token')) : null,
            'app_version' => $this->filled('app_version') ? trim((string) $this->input('app_version')) : null,
            'build_number' => $this->filled('build_number') ? trim((string) $this->input('build_number')) : null,
            'locale' => $this->filled('locale') ? trim((string) $this->input('locale')) : null,
            'timezone' => $this->filled('timezone') ? trim((string) $this->input('timezone')) : null,
        ]);
    }
}
