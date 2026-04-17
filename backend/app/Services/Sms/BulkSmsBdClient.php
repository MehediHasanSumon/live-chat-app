<?php

namespace App\Services\Sms;

use App\Models\SmsServiceCredential;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class BulkSmsBdClient
{
    public function send(SmsServiceCredential $credential, string $number, string $message): Response
    {
        return Http::asForm()
            ->withoutVerifying()
            ->timeout(15)
            ->post($credential->url, [
                'api_key' => $credential->api_key,
                'senderid' => $credential->sender_id,
                'number' => $number,
                'message' => $message,
            ]);
    }
}
