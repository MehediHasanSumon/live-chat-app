<?php

namespace App\Http\Requests\Message;

use Illuminate\Foundation\Http\FormRequest;

class StoreTextMessageRequest extends FormRequest
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
            'text' => ['required', 'string', 'max:5000'],
            'reply_to_message_id' => ['nullable', 'integer', 'exists:messages,id'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }
}
