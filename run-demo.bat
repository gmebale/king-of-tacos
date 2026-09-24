@echo off
echo ========================================
echo King Of Tacos - DEMO LAUNCHER (Windows)
echo ========================================
echo.

REM Stop containers existants
docker compose -f docker-compose.demo.yml down -v
echo Containers arrêtés.

REM Pull images + up
echo Démarrage stack complète (MySQL + API + Frontend + HTTPS)...
docker compose -f docker-compose.demo.yml up -d --build

echo.
echo Attente initialisation (2min)...
timeout /t 10
