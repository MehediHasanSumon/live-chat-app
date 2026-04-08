<?php

namespace App\Http\Requests\Message;

use Illuminate\Foundation\Http\FormRequest;

class StoreVoiceMessageRequest extends FormRequest
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
            'client_uuid' => ['nullable', 'uuid'],
            'storage_object_id' => ['required', 'integer', 'exists:storage_objects,id'],
            'duration_ms' => ['required', 'integer', 'min:1'],
            'waveform' => ['nullable', 'array', 'max:256'],
            'waveform.*' => ['numeric'],
        ];
    }
}
