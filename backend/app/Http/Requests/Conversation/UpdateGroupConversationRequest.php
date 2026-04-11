<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'avatar_object_id' => [
                'sometimes',
                'nullable',
                'integer',
                'exists:storage_objects,id',
                Rule::prohibitedIf($this->hasFile('avatar_file')),
            ],
            'avatar_file' => ['sometimes', 'file', 'image', 'max:'.config('uploads.max_upload_kb')],
            'clear_avatar' => ['sometimes', 'boolean'],
            'settings_json' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
