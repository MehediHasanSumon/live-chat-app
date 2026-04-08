<?php

namespace App\Providers;

use App\Models\Conversation;
use App\Policies\ConversationPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Conversation::class, ConversationPolicy::class);

        RateLimiter::for('web-login', function (Request $request): Limit {
            $login = (string) $request->input('login', 'guest');

            return Limit::perMinute(5)->by($login.'|'.$request->ip());
        });

        RateLimiter::for('web-register', function (Request $request): Limit {
            $username = (string) $request->input('username', 'guest');

            return Limit::perMinute(3)->by($username.'|'.$request->ip());
        });
    }
}
