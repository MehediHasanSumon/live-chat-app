<?php

use App\Http\Controllers\LiveKitController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', function (Request $request): array {
        return [
            'data' => $request->user()->loadMissing('settings'),
        ];
    });

    Route::post('/livekit/token', [LiveKitController::class, 'token']);
    Route::post('/livekit/rooms', [LiveKitController::class, 'createRoom']);
    Route::get('/livekit/rooms', [LiveKitController::class, 'listRooms']);
});

Route::post('/webhooks/livekit', [LiveKitController::class, 'webhook']);
