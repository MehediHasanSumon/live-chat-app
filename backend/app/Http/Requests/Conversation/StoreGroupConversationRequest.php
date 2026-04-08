<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class StoreGroupConversationRequest extends FormRequest
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
            'title' => ['required', 'string', 'min:2', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'avatar_object_id' => ['nullable', 'integer', 'exists:storage_objects,id'],
            'member_ids' => ['required', 'array', 'min:1', 'max:11'],
            'member_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'settings_json' => ['nullable', 'array'],
        ];
    }
}
