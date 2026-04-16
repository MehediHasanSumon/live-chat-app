<?php

namespace App\Http\Requests\Call;

use App\Http\Requests\Call\Concerns\HasCallDeviceRules;
use Illuminate\Foundation\Http\FormRequest;

class CallDeviceReadyRequest extends FormRequest
{
    use HasCallDeviceRules;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return $this->callDeviceRules();
    }
}
