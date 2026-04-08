<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGroupConversationRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'min:2', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'avatar_object_id' => ['sometimes', 'nullable', 'integer', 'exists:storage_objects,id'],
            'settings_json' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
