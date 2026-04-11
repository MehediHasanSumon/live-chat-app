# Horizon Production Checklist

Use this when deploying the Laravel backend as a production-like large application.

## 1. Environment

Set these values in the real production `.env`:

```env
APP_ENV=production
APP_DEBUG=false

CACHE_STORE=redis
SESSION_DRIVER=redis
SESSION_CONNECTION=default
QUEUE_CONNECTION=redis
REDIS_QUEUE_CONNECTION=default

HORIZON_USE=default
HORIZON_PATH=horizon
HORIZON_PREFIX=chat_app_horizon:
HORIZON_WAIT_SECONDS=60
HORIZON_MAX_PROCESSES=8
HORIZON_LOCAL_MAX_PROCESSES=2
HORIZON_SUPERVISOR_MEMORY=256
HORIZON_ALLOWED_EMAILS=admin@example.com
```

## 2. Install and Cache

Run these on the Linux/VPS server:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache
```

## 3. Start Horizon

For a quick manual start:

```bash
php artisan horizon
```

For zero-downtime deploys after code updates:

```bash
php artisan horizon:terminate
```

## 4. Process Manager

Do not rely on a manually opened terminal in production. Use `systemd` or Supervisor.

This repo includes an example systemd unit:

- `deploy/systemd/laravel-horizon.service.example`

## 5. Dashboard Access

The Horizon dashboard is protected by `HORIZON_ALLOWED_EMAILS`.

Only authenticated users whose email exists in that CSV list can open `/horizon` outside local environments.

## 6. Important Note for Windows Development

Horizon requires the `pcntl` and `posix` PHP extensions to run workers. These are not available on standard Windows PHP builds.

That means:

- you can keep the package and config in the repo on Windows
- you can deploy and run Horizon on Linux/VPS
- you should not expect `php artisan horizon` to run locally on Windows
