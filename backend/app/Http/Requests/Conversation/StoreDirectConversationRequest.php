<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class StoreDirectConversationRequest extends FormRequest
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
            'target_user_id' => ['required', 'integer', 'exists:users,id'],
        ];
    }
}
