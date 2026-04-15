<?php

use App\Jobs\DispatchScheduledNotificationDigestsJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new DispatchScheduledNotificationDigestsJob())->everyMinute();
Schedule::command('calls:cleanup-stale')->everyMinute();
Schedule::command('chat:cleanup-large-files')->dailyAt('02:00')->withoutOverlapping();
Schedule::command('chat:cleanup-small-files')->dailyAt('02:15')->withoutOverlapping();
Schedule::command('activitylog:clean --force')->daily();
