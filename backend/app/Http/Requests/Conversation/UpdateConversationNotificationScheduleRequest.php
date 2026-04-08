<?php

namespace App\Http\Requests\Conversation;

use Illuminate\Foundation\Http\FormRequest;

class UpdateConversationNotificationScheduleRequest extends FormRequest
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
            'notifications_mode' => ['required', 'string', 'in:all,mentions,mute,scheduled'],
            'notification_schedule_json' => ['nullable', 'array'],
        ];
    }
}
