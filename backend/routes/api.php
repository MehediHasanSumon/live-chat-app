<?php

use App\Http\Controllers\CallController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\LiveKitController;
use App\Http\Controllers\AdminStoragePolicyController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\RealtimeController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\UploadController;
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
    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::patch('/conversations/{conversation}/archive', [ConversationController::class, 'archive']);
    Route::patch('/conversations/{conversation}/unarchive', [ConversationController::class, 'unarchive']);
    Route::patch('/conversations/{conversation}/pin', [ConversationController::class, 'pin']);
    Route::patch('/conversations/{conversation}/unpin', [ConversationController::class, 'unpin']);
    Route::patch('/conversations/{conversation}/mute', [ConversationController::class, 'mute']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);
    Route::post('/conversations/{conversation}/messages/text', [MessageController::class, 'storeText']);
    Route::post('/conversations/{conversation}/typing', [RealtimeController::class, 'startTyping']);
    Route::delete('/conversations/{conversation}/typing', [RealtimeController::class, 'stopTyping']);
    Route::post('/conversations/{conversation}/calls/group/voice', [CallController::class, 'startGroup'])->defaults('mediaType', 'voice');
    Route::post('/conversations/{conversation}/calls/group/video', [CallController::class, 'startGroup'])->defaults('mediaType', 'video');

    Route::post('/groups', [GroupController::class, 'store']);
    Route::patch('/groups/{conversation}', [GroupController::class, 'update']);

    Route::patch('/messages/{message}', [MessageController::class, 'update']);
    Route::delete('/messages/{message}', [MessageController::class, 'destroy']);
    Route::post('/messages/{message}/forward', [MessageController::class, 'forward']);
    Route::post('/messages/{message}/reactions', [ReactionController::class, 'store']);
    Route::delete('/messages/{message}/reactions/{emoji}', [ReactionController::class, 'destroy']);
    Route::post('/uploads', [UploadController::class, 'store']);
    Route::post('/uploads/{storageObject}/attach', [UploadController::class, 'attach']);
    Route::post('/presence/heartbeat', [RealtimeController::class, 'heartbeat']);
    Route::post('/calls/direct/{user}/voice', [CallController::class, 'startDirect'])->defaults('mediaType', 'voice');
    Route::post('/calls/direct/{user}/video', [CallController::class, 'startDirect'])->defaults('mediaType', 'video');
    Route::post('/calls/{callRoom}/accept', [CallController::class, 'accept']);
    Route::post('/calls/{callRoom}/decline', [CallController::class, 'decline']);
    Route::post('/calls/{callRoom}/end', [CallController::class, 'end']);
    Route::post('/calls/{callRoom}/join-token', [CallController::class, 'joinToken']);

    Route::post('/livekit/token', [LiveKitController::class, 'token']);
    Route::post('/livekit/rooms', [LiveKitController::class, 'createRoom']);
    Route::get('/livekit/rooms', [LiveKitController::class, 'listRooms']);

    Route::get('/admin/storage/policy', [AdminStoragePolicyController::class, 'showPolicy']);
    Route::patch('/admin/storage/policy', [AdminStoragePolicyController::class, 'updatePolicy']);
    Route::get('/admin/storage/usage', [AdminStoragePolicyController::class, 'usage']);
    Route::post('/admin/storage/cleanup/preview', [AdminStoragePolicyController::class, 'previewCleanup']);
    Route::post('/admin/storage/cleanup/run', [AdminStoragePolicyController::class, 'runCleanup']);
    Route::post('/admin/storage/objects/{storageObject}/exempt', [AdminStoragePolicyController::class, 'exempt']);
    Route::delete('/admin/storage/objects/{storageObject}/exempt', [AdminStoragePolicyController::class, 'removeExemption']);
});

Route::post('/webhooks/livekit', [LiveKitController::class, 'webhook']);
Route::get('/files/{objectUuid}/download', [UploadController::class, 'download'])
    ->middleware('signed')
    ->name('files.download');
