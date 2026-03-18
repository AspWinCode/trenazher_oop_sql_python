#!/bin/bash
set -euo pipefail

cd /opt/platform

echo "=== Deploying Task Checker Platform ==="

# --- Copy prod configs ---
cp deploy/docker-compose.prod.yml docker-compose.yml
cp deploy/.env.prod .env

for placeholder in \
  "SECRET_KEY=replace-with-long-random-secret-key" \
  "POSTGRES_PASSWORD=replace-with-strong-db-password" \
  "ADMIN_PASSWORD=replace-with-strong-admin-password" \
  "JUDGER_INTERNAL_TOKEN=replace-with-long-random-token" \
  "CORS_ORIGINS=https://your-frontend-domain"
do
  if grep -q "^${placeholder}$" .env; then
    echo "ERROR: set a real value for ${placeholder%%=*} in deploy/.env.prod before deploy"
    exit 1
  fi
done

if grep -q '^ADMIN_PASSWORD=admin$' .env; then
  echo "ERROR: ADMIN_PASSWORD must not be 'admin' in production"
  exit 1
fi

# --- Build sandbox images ---
echo "[1/5] Building sandbox images..."
docker build -t platform-sandbox-python:latest -f judger/sandbox/Dockerfile.python judger/sandbox/
docker build -t platform-sandbox-sql:latest -f judger/sandbox/Dockerfile.sql judger/sandbox/
docker build -t platform-sandbox-cpp:latest -f judger/sandbox/Dockerfile.cpp judger/sandbox/
docker build -t platform-sandbox-js:latest -f judger/sandbox/Dockerfile.js judger/sandbox/
echo "Sandbox images built."

# --- Build and start services ---
echo "[2/5] Building application images..."
docker compose build

echo "[3/5] Starting services..."
docker compose up -d

# --- Wait for backend health ---
echo "[4/5] Waiting for backend health..."
READY=0
for i in {1..30}; do
  if curl -fsS http://localhost:8000/api/health >/tmp/platform-health.json 2>/dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "Backend health endpoint is not ready in time."
  echo "Inspect logs with: docker compose logs --tail=200 backend judger"
  exit 1
fi

echo "[5/5] Service status"
docker compose ps

PUBLIC_IP=$(curl -s ifconfig.me || echo "<your-server-ip>")

echo ""
echo "=== Deployment complete ==="
echo "Frontend: http://${PUBLIC_IP}"
echo "API:      http://${PUBLIC_IP}:8000"
echo "API Docs: http://${PUBLIC_IP}:8000/docs"
echo ""
echo "Run e2e check:"
echo "docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-check e2e-check"
echo ""
echo "IMPORTANT: keep secrets in deploy/.env.prod outside VCS."
