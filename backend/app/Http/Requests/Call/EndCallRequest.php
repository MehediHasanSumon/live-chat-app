<?php

namespace App\Http\Requests\Call;

use Illuminate\Foundation\Http\FormRequest;

class EndCallRequest extends FormRequest
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
        return [
            'reason' => ['nullable', 'string', 'max:60'],
        ];
    }
}
