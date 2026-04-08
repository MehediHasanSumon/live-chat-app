<?php

namespace App\Http\Requests\Message;

use Illuminate\Foundation\Http\FormRequest;

class StoreGifMessageRequest extends FormRequest
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
            'gif_meta' => ['required', 'array'],
            'gif_meta.url' => ['required', 'url', 'max:2048'],
            'gif_meta.title' => ['nullable', 'string', 'max:120'],
            'gif_meta.preview_url' => ['nullable', 'url', 'max:2048'],
            'gif_meta.provider' => ['nullable', 'string', 'max:40'],
        ];
    }
}
