<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\Auth\Concerns\ReturnsJsonValidationErrors;
use Illuminate\Foundation\Http\FormRequest;

class WebLoginRequest extends FormRequest
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
            'login' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'max:255'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    public function login(): string
    {
        return trim((string) $this->string('login'));
    }

    public function password(): string
    {
        return (string) $this->string('password');
    }

    public function remember(): bool
    {
        return (bool) $this->boolean('remember');
    }
}
