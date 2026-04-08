<?php

namespace App\Http\Requests\Storage;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RunStorageCleanupRequest extends FormRequest
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
            'rule_key' => ['required', 'string', Rule::in(['large_after_7d', 'small_after_30d', 'manual'])],
            'dry_run' => ['nullable', 'boolean'],
        ];
    }
}
