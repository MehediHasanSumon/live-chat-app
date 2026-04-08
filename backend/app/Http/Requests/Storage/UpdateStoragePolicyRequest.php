<?php

namespace App\Http\Requests\Storage;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoragePolicyRequest extends FormRequest
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
            'global_cap_bytes' => ['sometimes', 'integer', 'min:1'],
            'auto_cleanup_enabled' => ['sometimes', 'boolean'],
            'large_file_threshold_bytes' => ['sometimes', 'integer', 'min:1'],
            'large_file_rule_enabled' => ['sometimes', 'boolean'],
            'large_file_delete_after_days' => ['sometimes', 'integer', 'min:1', 'max:3650'],
            'small_file_threshold_bytes' => ['sometimes', 'integer', 'min:1'],
            'small_file_rule_enabled' => ['sometimes', 'boolean'],
            'small_file_delete_after_days' => ['sometimes', 'integer', 'min:1', 'max:3650'],
            'cleanup_behavior' => ['sometimes', 'string', Rule::in(['delete_binary_keep_message'])],
        ];
    }
}
