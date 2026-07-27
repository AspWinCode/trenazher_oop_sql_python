#!/bin/bash
# Идемпотентный деплой: тянет свежий код, ГАРАНТИРУЕТ наличие сэндбокс-образов
# джаджера (собирает недостающие) и перезапускает приложение.
#
# Использовать как единую команду обновления прода:
#   bash /opt/itpractikum/update.sh
#
# ВАЖНО: сэндбокс-образы (platform-sandbox-*) не привязаны к запущенному
# контейнеру — джаджер создаёт из них одноразовые контейнеры на каждую проверку.
# Поэтому `docker system prune -a` и `docker image prune -a` их УДАЛЯЮТ, после чего
# джаджер ловит "pull access denied". Для очистки используйте только безопасные
# `docker image prune -f` (dangling) и `docker builder prune -f`. Если образы всё же
# пропали — просто запустите этот скрипт, он их пересоберёт.
set -e

APP_DIR="/opt/itpractikum"
COMPOSE="docker compose -f $APP_DIR/docker/docker-compose.yml"

cd "$APP_DIR"

echo "== 1/4 git pull =="
git pull origin master

echo "== 2/4 проверка сэндбокс-образов джаджера =="
cd "$APP_DIR/judger/sandbox"
for lang in python sql cpp js; do
    img="platform-sandbox-$lang:latest"
    if docker image inspect "$img" >/dev/null 2>&1; then
        echo "   $img — на месте"
    else
        echo "   $img — отсутствует, собираю..."
        docker build -f "Dockerfile.$lang" -t "$img" .
    fi
done

echo "== 3/4 пересборка и перезапуск приложения =="
cd "$APP_DIR"
$COMPOSE build backend frontend
$COMPOSE up -d

echo "== 4/4 версия миграций =="
$COMPOSE exec -T backend alembic current || true

echo "== Готово =="
