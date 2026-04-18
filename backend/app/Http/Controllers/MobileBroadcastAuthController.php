<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class MobileBroadcastAuthController extends Controller
{
    public function __invoke(Request $request): mixed
    {
        $request->validate([
            'socket_id' => ['required', 'string'],
            'channel_name' => ['required', 'string'],
        ]);

        return Broadcast::auth($request);
    }
}
