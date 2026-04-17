#!/bin/bash
set -e

REPO_URL="https://github.com/sfeducation/sf-practikum.git"
APP_DIR="/opt/itpractikum"
DOMAIN="itpractikum.sflearning.ru"

echo "=== IT Practikum Deploy Script ==="

# 1. Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 2. Install docker-compose plugin if not installed
if ! docker compose version &> /dev/null; then
    echo "Installing docker compose plugin..."
    apt-get update -qq
    apt-get install -y docker-compose-plugin
fi

# 3. Install nginx and certbot if not installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx and certbot..."
    apt-get update -qq
    apt-get install -y nginx certbot python3-certbot-nginx
fi

# 4. Clone or update repo
if [ -d "$APP_DIR" ]; then
    echo "Updating repo..."
    cd "$APP_DIR"
    git pull origin master
else
    echo "Cloning repo..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 5. Copy .env if not exists
if [ ! -f "$APP_DIR/docker/.env" ]; then
    echo "Creating .env from template..."
    cp "$APP_DIR/docker/.env.prod" "$APP_DIR/docker/.env"
    echo ">>> EDIT $APP_DIR/docker/.env if needed <<<"
fi

# 6. Build sandbox Docker images
echo "Building sandbox images..."
cd "$APP_DIR/judger/sandbox"
docker build -f Dockerfile.python -t platform-sandbox-python:latest .
docker build -f Dockerfile.sql    -t platform-sandbox-sql:latest .
docker build -f Dockerfile.cpp    -t platform-sandbox-cpp:latest .
docker build -f Dockerfile.js     -t platform-sandbox-js:latest .

# 7. Start all services
echo "Starting services..."
cd "$APP_DIR/docker"
docker compose --env-file .env up -d --build postgres redis backend judger frontend

# 8. Configure nginx
echo "Configuring nginx..."
cp "$APP_DIR/docker/nginx.prod.conf" /etc/nginx/sites-available/itpractikum
ln -sf /etc/nginx/sites-available/itpractikum /etc/nginx/sites-enabled/itpractikum
rm -f /etc/nginx/sites-enabled/default

# Temp HTTP-only config to get SSL cert
cat > /etc/nginx/sites-available/itpractikum-temp << 'EOF'
server {
    listen 80;
    server_name itpractikum.sflearning.ru www.itpractikum.sflearning.ru;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
EOF
ln -sf /etc/nginx/sites-available/itpractikum-temp /etc/nginx/sites-enabled/itpractikum
nginx -t && systemctl reload nginx

# 9. Get SSL certificate
echo "Getting SSL certificate..."
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos -m admin@sflearning.ru \
    || echo "Certbot failed - may need to run manually"

# 10. Switch to SSL nginx config
ln -sf /etc/nginx/sites-available/itpractikum /etc/nginx/sites-enabled/itpractikum
nginx -t && systemctl reload nginx

echo ""
echo "=== Deploy complete! ==="
echo "Site: https://$DOMAIN"
echo "Admin panel: https://$DOMAIN (login: admin)"
echo ""
echo "Check status: docker compose -f $APP_DIR/docker/docker-compose.yml ps"
echo "Check logs:   docker compose -f $APP_DIR/docker/docker-compose.yml logs -f backend"
