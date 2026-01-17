#!/usr/bin/env bash
# Script de diagnostic pour identifier pourquoi REACT_APP_API_URL n'est pas correcte

echo "=== DIAGNOSTIC REACT_APP_API_URL ==="
echo ""

DEPLOY_ROOT="/opt/kot-project/king-of-tacos"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$DEPLOY_ROOT/.deploy.env}"

echo "1. Vérification du fichier .deploy.env:"
if [ -f "$DEPLOY_ENV_FILE" ]; then
  echo "   ✓ Fichier existe: $DEPLOY_ENV_FILE"
  echo "   Contenu REACT_APP_API_URL:"
  grep "REACT_APP_API_URL" "$DEPLOY_ENV_FILE" || echo "   ⚠ REACT_APP_API_URL non trouvé dans .deploy.env"
else
  echo "   ✗ Fichier n'existe pas: $DEPLOY_ENV_FILE"
fi
echo ""

echo "2. Variables d'environnement système:"
if [ -n "${REACT_APP_API_URL:-}" ]; then
  echo "   REACT_APP_API_URL=$REACT_APP_API_URL"
else
  echo "   REACT_APP_API_URL n'est pas définie dans l'environnement système"
fi
echo ""

echo "3. Fichiers .env dans kot-frontend:"
cd "$DEPLOY_ROOT/kot-frontend" 2>/dev/null || echo "   ⚠ Répertoire kot-frontend non trouvé"
for env_file in .env .env.local .env.production .env.production.local; do
  if [ -f "$env_file" ]; then
    echo "   ⚠ Fichier trouvé: $env_file"
    echo "      Contenu REACT_APP_API_URL:"
    grep "REACT_APP_API_URL" "$env_file" 2>/dev/null || echo "      (non trouvé)"
  fi
done
echo ""

echo "4. Chargement du .deploy.env et vérification:"
if [ -f "$DEPLOY_ENV_FILE" ]; then
  set -a
  . "$DEPLOY_ENV_FILE"
  set +a
  echo "   Après chargement, REACT_APP_API_URL=$REACT_APP_API_URL"
else
  echo "   ⚠ Impossible de charger .deploy.env"
fi
echo ""

echo "5. Images Docker existantes:"
docker images | grep "kot-frontend" || echo "   Aucune image kot-frontend trouvée"
echo ""

echo "6. Vérification du contenu de l'image (si elle existe):"
if docker images | grep -q "kot-frontend"; then
  echo "   Inspection de l'image pour REACT_APP_API_URL..."
  docker run --rm kot-frontend:latest sh -c 'echo $REACT_APP_API_URL' 2>/dev/null || echo "   ⚠ Impossible d'inspecter l'image"
else
  echo "   Aucune image à inspecter"
fi
echo ""

echo "=== FIN DU DIAGNOSTIC ==="
