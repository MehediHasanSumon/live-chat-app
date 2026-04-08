<?php

namespace App\Http\Requests\Call;

use Illuminate\Foundation\Http\FormRequest;

class IssueJoinTokenRequest extends FormRequest
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
            'wants_video' => ['sometimes', 'boolean'],
        ];
    }
}
