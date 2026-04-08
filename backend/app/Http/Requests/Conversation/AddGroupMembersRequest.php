<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class AddGroupMembersRequest extends FormRequest
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
            'member_ids' => ['required', 'array', 'min:1', 'max:11'],
            'member_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }
}
