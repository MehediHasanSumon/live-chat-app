<?php

namespace App\Http\Requests\Storage;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUploadRequest extends FormRequest
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
            'file' => ['required', 'file', 'max:'.config('uploads.max_upload_kb')],
            'purpose' => ['nullable', 'string', Rule::in(['message_attachment', 'user_avatar', 'group_avatar'])],
        ];
    }
}
