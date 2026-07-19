#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="./dist"
DEST_DIR="/srv/www/phototable"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Build output not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
find "$DEST_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R "$SRC_DIR"/. "$DEST_DIR"/
chmod -R a+rX "$DEST_DIR"

if command -v docker >/dev/null 2>&1; then
  docker compose -f ./docker-compose.yml restart web-landing
else
  echo "Deploy copied files, but docker was not found; restart web-landing manually." >&2
fi
