<?php

use App\Http\Controllers\WebAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::post('/register', [WebAuthController::class, 'register'])->middleware('throttle:web-register');
Route::post('/login', [WebAuthController::class, 'login'])->middleware('throttle:web-login')->name('login');
Route::post('/forgot-password', [WebAuthController::class, 'forgotPassword'])->middleware('throttle:auth-code');
Route::post('/reset-password/verify-code', [WebAuthController::class, 'verifyPasswordResetCode'])->middleware('throttle:auth-code');
Route::post('/reset-password', [WebAuthController::class, 'resetPassword'])->middleware('throttle:auth-code');
Route::post('/email/verification/send', [WebAuthController::class, 'sendEmailVerification'])->middleware(['auth:web', 'throttle:auth-code']);
Route::post('/email/verification/verify', [WebAuthController::class, 'verifyEmail'])->middleware(['auth:web', 'throttle:auth-code']);
Route::post('/logout', [WebAuthController::class, 'logout'])->middleware('auth:web');
