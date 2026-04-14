<?php

namespace App\Providers;

use App\Support\Access\AdminRole;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        parent::boot();

        // Horizon::routeSmsNotificationsTo('15556667777');
        // Horizon::routeMailNotificationsTo('example@example.com');
        // Horizon::routeSlackNotificationsTo('slack-webhook-url', '#channel');
    }

    /**
     * Register the Horizon gate.
     *
     * This gate determines who can access Horizon in non-local environments.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', function ($user = null) {
            if ($user && method_exists($user, 'hasAnyRole') && $user->hasAnyRole([AdminRole::SUPER_ADMIN, AdminRole::ADMIN])) {
                return true;
            }

            $allowedEmails = collect(explode(',', (string) env('HORIZON_ALLOWED_EMAILS', '')))
                ->map(fn (string $email): string => trim($email))
                ->filter()
                ->values()
                ->all();

            return in_array(optional($user)->email, $allowedEmails, true);
        });
    }
}
