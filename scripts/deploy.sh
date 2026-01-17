#!/usr/bin/env bash
set -euo pipefail

cd /opt/kot-project/king-of-tacos

git pull

docker compose up -d --build api proxy
docker compose -f docker-compose.frontend.yml up -d --build

