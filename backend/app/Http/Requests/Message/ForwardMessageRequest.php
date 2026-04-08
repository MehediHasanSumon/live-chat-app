<?php

namespace App\Http\Requests\Message;

use Illuminate\Foundation\Http\FormRequest;

class ForwardMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'target_conversation_id' => ['required', 'integer', 'exists:conversations,id'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }
}
