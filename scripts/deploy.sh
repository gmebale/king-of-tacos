#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="/opt/kot-project/king-of-tacos"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$DEPLOY_ROOT/.deploy.env}"

if [ -f "$DEPLOY_ENV_FILE" ]; then
  set -a
  . "$DEPLOY_ENV_FILE"
  set +a
  # Exporter explicitement les variables pour docker compose
  export REACT_APP_API_URL
  export REACT_APP_STRIPE_PUBLISHABLE_KEY
fi

send_telegram() {
  local msg="$1"
  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi
  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${msg}" >/dev/null || true
}

send_telegram "Deploy started on $(hostname) at $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
trap 'send_telegram "Deploy failed on $(hostname). Check server logs."; exit 1' ERR

cd "$DEPLOY_ROOT"

git pull

GIT_SHA="$(git rev-parse --short HEAD)"
GIT_MSG="$(git log -1 --pretty=%s)"

# Debug: afficher la valeur de REACT_APP_API_URL (sans exposer les secrets)
echo "=========================================="
echo "REACT_APP_API_URL=${REACT_APP_API_URL:-NOT SET}"
echo "=========================================="

docker compose up -d --build api proxy

# Supprimer l'ancienne image pour forcer un rebuild complet
echo "Suppression de l'ancienne image frontend..."
docker rmi kot-frontend:latest 2>/dev/null || true

# Rebuild sans cache pour forcer l'utilisation des nouvelles variables
echo "Rebuild du frontend sans cache..."
docker compose -f docker-compose.frontend.yml build --no-cache --pull frontend

# Vérifier que la variable est bien passée
echo "Vérification des variables de build..."
docker compose -f docker-compose.frontend.yml config | grep -A 5 "REACT_APP_API_URL" || echo "Variable non trouvée dans la config"

docker compose -f docker-compose.frontend.yml up -d frontend

send_telegram "Deploy finished on $(hostname) at $(date -u +'%Y-%m-%d %H:%M:%S UTC')%0ACommit: ${GIT_SHA} - ${GIT_MSG}"

