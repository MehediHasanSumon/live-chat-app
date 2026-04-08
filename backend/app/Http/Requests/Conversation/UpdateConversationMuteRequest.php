<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class UpdateConversationMuteRequest extends FormRequest
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
            'muted_until' => ['nullable', 'date'],
        ];
    }
}
