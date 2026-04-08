<?php

namespace App\Http\Requests\Message;

use Illuminate\Foundation\Http\FormRequest;

class StoreMediaMessageRequest extends FormRequest
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
            'caption' => ['nullable', 'string', 'max:4000'],
            'storage_object_ids' => ['required', 'array', 'min:1', 'max:10'],
            'storage_object_ids.*' => ['integer', 'distinct', 'exists:storage_objects,id'],
        ];
    }
}
