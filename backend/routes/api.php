<?php

use App\Http\Controllers\ConversationController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\LiveKitController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\WebAuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', MeController::class);

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations/direct', [ConversationController::class, 'storeDirect']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::patch('/conversations/{conversation}/archive', [ConversationController::class, 'archive']);
    Route::patch('/conversations/{conversation}/unarchive', [ConversationController::class, 'unarchive']);
    Route::patch('/conversations/{conversation}/pin', [ConversationController::class, 'pin']);
    Route::patch('/conversations/{conversation}/unpin', [ConversationController::class, 'unpin']);
    Route::patch('/conversations/{conversation}/mute', [ConversationController::class, 'mute']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);

    Route::post('/groups', [GroupController::class, 'store']);
    Route::patch('/groups/{conversation}', [GroupController::class, 'update']);

    Route::post('/livekit/token', [LiveKitController::class, 'token']);
    Route::post('/livekit/rooms', [LiveKitController::class, 'createRoom']);
    Route::get('/livekit/rooms', [LiveKitController::class, 'listRooms']);
});

Route::post('/webhooks/livekit', [LiveKitController::class, 'webhook']);
