<?php

namespace App\Services\LiveKit;

use Agence104\LiveKit\WebhookReceiver;
use Illuminate\Http\Request;

class LiveKitWebhookService
{
    public function parse(Request $request): array
    {
        $receiver = new WebhookReceiver(
            config('livekit.api_key'),
            config('livekit.api_secret'),
        );

        $event = $receiver->receive(
            $request->getContent(),
            $request->header('Authorization')
        );

        return json_decode($event->serializeToJsonString(), true, 512, JSON_THROW_ON_ERROR);
    }
}
