<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Auth\Concerns\ReturnsJsonValidationErrors;
use Illuminate\Foundation\Http\FormRequest;

class UnregisterUserDeviceRequest extends FormRequest
{
    use ReturnsJsonValidationErrors;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'device_uuid' => ['required', 'string', 'max:80'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $routeValue = $this->route('deviceUuid') ?? $this->route('device_uuid');

        $this->merge([
            'device_uuid' => trim((string) ($routeValue ?? $this->input('device_uuid'))),
        ]);
    }
}
