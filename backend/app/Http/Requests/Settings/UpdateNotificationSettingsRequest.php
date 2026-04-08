<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationSettingsRequest extends FormRequest
{
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
            'push_enabled' => ['required', 'boolean'],
            'sound_enabled' => ['required', 'boolean'],
            'vibrate_enabled' => ['required', 'boolean'],
        ];
    }
}
