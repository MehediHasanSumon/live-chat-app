<?php

namespace App\Http\Requests\Call\Concerns;

trait HasCallDeviceRules
{
    /**
     * @return array<string, mixed>
     */
    protected function callDeviceRules(): array
    {
        return [
            'device_ready' => ['required', 'accepted'],
            'audio_input_device_id' => ['required', 'string', 'max:255'],
            'audio_output_device_id' => ['nullable', 'string', 'max:255'],
        ];
    }
}
