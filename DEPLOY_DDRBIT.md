# DDRBit Server Deploy Guide

এই guide-টা `api.ddrbit.com` Laravel backend আর `app.ddrbit.com` Next.js frontend এক VPS-এ Apache reverse proxy দিয়ে deploy করার জন্য লেখা।

## 1. Assumptions

- OS: Ubuntu 24.04 or similar
- Paths:
  - backend: `/var/www/app/backend`
  - frontend: `/var/www/app/frontend`
- Web server: Apache
- Database: MySQL
- Cache/queue/session: Redis
- Realtime: Laravel Reverb on `127.0.0.1:8080`
- Frontend: Next.js standalone server on `127.0.0.1:3000`
- LiveKit already exists separately or you are using LiveKit Cloud

## 2. Install packages

```bash
sudo apt update
sudo apt install -y apache2 redis-server unzip git curl
sudo apt install -y php8.3 php8.3-cli libapache2-mod-php8.3 php8.3-common php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-mysql php8.3-bcmath php8.3-intl php8.3-gd php8.3-redis
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo a2enmod rewrite headers ssl proxy proxy_http proxy_wstunnel
```

## 3. Upload project

```bash
sudo mkdir -p /var/www/app
sudo chown -R $USER:$USER /var/www/app
cd /var/www/app

git clone <your-repo-url> backend
git clone <your-repo-url> frontend
```

যদি একই repo-তে `backend` আর `frontend` folder থাকে, তাহলে repo root clone করে দুই path ঠিকমতো place করো।

## 4. Backend setup

```bash
cd /var/www/app/backend
cp .env.ddrbit.production.example .env
composer install --no-dev --optimize-autoloader
npm install
npm run build
php artisan key:generate
```

`.env` edit করে minimum এই values replace করো:

- `APP_KEY`
- `DB_*`
- `REDIS_*`
- `REVERB_APP_KEY`
- `REVERB_APP_SECRET`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `HORIZON_ALLOWED_EMAILS`

তারপর:

```bash
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache
```

## 5. Frontend setup

```bash
cd /var/www/app/frontend
cp .env.production.example .env.production
npm ci
npm run build:deploy
```

`.env.production` edit করে minimum এই values ঠিক করো:

- `NEXT_PUBLIC_REVERB_APP_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`

`build:deploy` script `.next/static` আর `public` automatically `.next/standalone`-এ copy করে দেয়, তাই `systemd` service সরাসরি standalone server চালাতে পারবে।

## 6. File permissions

```bash
sudo chown -R www-data:www-data /var/www/app/backend
sudo chown -R www-data:www-data /var/www/app/frontend
sudo find /var/www/app/backend -type f -exec chmod 644 {} \;
sudo find /var/www/app/backend -type d -exec chmod 755 {} \;
sudo find /var/www/app/frontend -type f -exec chmod 644 {} \;
sudo find /var/www/app/frontend -type d -exec chmod 755 {} \;
sudo chmod -R ug+rwx /var/www/app/backend/storage /var/www/app/backend/bootstrap/cache
```

## 7. Systemd services

```bash
sudo cp /var/www/app/backend/deploy/systemd/ddrbit-frontend.service.example /etc/systemd/system/ddrbit-frontend.service
sudo cp /var/www/app/backend/deploy/systemd/laravel-reverb.service.example /etc/systemd/system/laravel-reverb.service
sudo cp /var/www/app/backend/deploy/systemd/laravel-horizon.service.example /etc/systemd/system/laravel-horizon.service
sudo cp /var/www/app/backend/deploy/systemd/laravel-scheduler.service.example /etc/systemd/system/laravel-scheduler.service
sudo cp /var/www/app/backend/deploy/systemd/laravel-scheduler.timer.example /etc/systemd/system/laravel-scheduler.timer

sudo systemctl daemon-reload
sudo systemctl enable --now ddrbit-frontend.service
sudo systemctl enable --now laravel-reverb.service
sudo systemctl enable --now laravel-horizon.service
sudo systemctl enable --now laravel-scheduler.timer
```

Check:

```bash
systemctl status ddrbit-frontend.service
systemctl status laravel-reverb.service
systemctl status laravel-horizon.service
systemctl status laravel-scheduler.timer
```

## 8. Apache virtual hosts

```bash
sudo cp /var/www/app/backend/deploy/apache/app.ddrbit.com.conf.example /etc/apache2/sites-available/app.ddrbit.com.conf
sudo cp /var/www/app/backend/deploy/apache/api.ddrbit.com.conf.example /etc/apache2/sites-available/api.ddrbit.com.conf
sudo a2ensite app.ddrbit.com.conf api.ddrbit.com.conf
sudo systemctl reload apache2
```

তারপর SSL issue করো:

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d app.ddrbit.com -d api.ddrbit.com
sudo systemctl reload apache2
```

## 9. DNS

- `A` record: `app.ddrbit.com` -> your VPS public IP
- `A` record: `api.ddrbit.com` -> your VPS public IP

## 10. Post-deploy checks

```bash
curl -I https://app.ddrbit.com
curl -I https://api.ddrbit.com/up
curl -I https://api.ddrbit.com/sanctum/csrf-cookie
```

Browser checks:

- `https://app.ddrbit.com` loads
- login works
- `https://api.ddrbit.com/up` returns healthy response
- messages list loads after login
- realtime connection succeeds
- Horizon opens only for allowed admin email

## 11. Update deploy flow

Code update হলে এই order follow করো:

```bash
cd /var/www/app/backend
git pull
composer install --no-dev --optimize-autoloader
npm install
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache
php artisan horizon:terminate
php artisan reverb:restart

cd /var/www/app/frontend
git pull
npm ci
npm run build:deploy
sudo systemctl restart ddrbit-frontend.service
```

## 12. Notes

- Laravel Sanctum cookie auth-এর জন্য `SESSION_DOMAIN=.ddrbit.com` আর `SANCTUM_STATEFUL_DOMAINS=app.ddrbit.com` already aligned.
- Reverb official production pattern অনুযায়ী public `443` traffic Apache handle করবে, কিন্তু actual Reverb server চলবে `127.0.0.1:8080`-এ।
- Next.js `output: "standalone"` build by default static assets copy করে না; এই repo-তে `npm run build:deploy` সেটা prepare করে দেয়।
- যদি একই VPS-এ LiveKit self-host করতে চাও, সেটা আলাদা infra step, কারণ media ports and TURN config লাগবে।
