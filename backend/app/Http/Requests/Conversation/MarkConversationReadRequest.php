<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class MarkConversationReadRequest extends FormRequest
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
            'last_seq' => ['required', 'integer', 'min:0'],
        ];
    }
}
