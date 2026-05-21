#!/bin/sh
set -eu

APP_DIR=${APP_DIR:-/opt/useremoji}

cd "$APP_DIR"
docker compose run --rm useremoji-bot node dist/deploy.js
