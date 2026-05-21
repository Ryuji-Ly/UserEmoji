#!/bin/sh
set -eu

APP_DIR=${APP_DIR:-/opt/useremoji}

if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

cd "$APP_DIR"
docker compose pull
docker compose up -d
