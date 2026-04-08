<?php

use App\Http\Controllers\WebAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::post('/register', [WebAuthController::class, 'register'])->middleware('throttle:web-register');
Route::post('/login', [WebAuthController::class, 'login'])->middleware('throttle:web-login')->name('login');
Route::post('/logout', [WebAuthController::class, 'logout'])->middleware('auth:web');
