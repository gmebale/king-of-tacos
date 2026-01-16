# Déploiement Docker de l’application (Hostinger VPS + domaine LWS)

Ce guide couvre l’industrialisation : création des images Docker, orchestration avec `docker compose`, publication sur un registry (GHCR ou Docker Hub), déploiement sur un VPS Hostinger, et automatisation via GitHub Actions. Il est pensé pour l’architecture du projet (`kot-backend/`, `kot-frontend/`).

## Aperçu rapide (TL;DR)
- VPS Hostinger (Ubuntu/Debian), accès SSH sudo.
- Installer Docker + docker compose plugin.
- Préparer des `Dockerfile` (backend, frontend), puis un `docker-compose.yml` qui inclut reverse proxy + services.
- Stocker les secrets dans des fichiers `.env` non commités.
- Builder/publier les images vers un registry (GHCR conseillé).
- Sur le VPS : `docker compose pull && docker compose up -d --remove-orphans`.
- DNS LWS : enregistrements A/AAAA vers l’IP du VPS. TLS automatique via Caddy ou Traefik.

## 1) Prérequis
- VPS Hostinger (plan VPS, pas l’hébergement mutualisé), SSH activé.
- Nom de domaine géré chez LWS, possibilité de créer des enregistrements DNS.
- Compte GitHub (repo du projet) et accès à un registry (GitHub Container Registry ou Docker Hub).
- Utilisateur sudo sur le VPS (ex. `root` ou `deploy`).

## 2) Installation de Docker sur le VPS (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
  $(. /etc/os-release; echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER   # optionnel pour éviter sudo
newgrp docker
```

## 3) Gestion des secrets et variables d’environnement
- Ne jamais commit les secrets. Utiliser des fichiers `.env` locaux :  
  - `kot-backend/.env.production` (DB_URL, JWT_SECRET, etc.)  
  - `kot-frontend/.env.production` (API_BASE_URL, etc.)  
  - éventuellement un `.env` racine pour des variables partagées (DOMAIN, EMAIL_LETSENCRYPT…).
- Sur le VPS, copier ces fichiers depuis un gestionnaire de secrets ou via `scp`. Exemple :
```bash
scp kot-backend/.env.production deploy@vps-ip:/opt/kot/kot-backend/.env.production
```

## 4) Dockerfile types (exemples)

### Backend (`kot-backend/Dockerfile`)
```Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]  # adapte si point d’entrée différent
```
Adapte le port et la commande au serveur réel (Express/Nest/etc.). Si build TypeScript, ajoute une étape build.

### Frontend (`kot-frontend/Dockerfile`)
```Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```
Adapte la commande de build (`npm run build`), le dossier de sortie (`dist` ou `build`).

## 5) docker-compose.yml (exemple minimal avec Caddy pour TLS)
À placer à la racine du projet.
```yaml
version: "3.9"
services:
  proxy:
    image: caddy:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
      - web

  api:
    build: ./kot-backend
    env_file: ./kot-backend/.env.production
    restart: unless-stopped
    expose:
      - "4000"
    # depends_on: [db]

  web:
    build: ./kot-frontend
    restart: unless-stopped
    expose:
      - "80"

  # db:
  #   image: postgres:15-alpine
  #   environment:
  #     POSTGRES_USER: app
  #     POSTGRES_PASSWORD: change-me
  #     POSTGRES_DB: app
  #   volumes:
  #     - db_data:/var/lib/postgresql/data
  #   restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
  # db_data:
```

### Caddyfile (exemple)
Créer `Caddyfile` à la racine :
```
{  
    email you@example.com
}

your-domain.com {
    encode gzip
    reverse_proxy /api/* api:4000
    reverse_proxy web:80
}
```
- Remplacer `your-domain.com` par le domaine LWS pointant vers l’IP du VPS.
- Caddy obtient automatiquement des certificats Let’s Encrypt.
- Si l’API n’est pas préfixée par `/api`, adapte les routes ou configure un sous-domaine (api.your-domain.com).

## 6) DNS chez LWS
- Enregistrement A (IPv4) et AAAA (IPv6 si dispo) vers l’IP publique du VPS pour `your-domain.com`.
- Délai de propagation DNS : quelques minutes à 24h.

## 7) Première mise en place sur le VPS
```bash
ssh deploy@vps-ip
sudo mkdir -p /opt/kot
cd /opt/kot
git clone https://github.com/ton-compte/ton-repo.git .

# Copier ou créer les .env nécessaires
# kot-backend/.env.production, kot-frontend/.env.production, éventuellement .env

docker compose build        # ou docker compose pull si images déjà publiées
docker compose up -d
```
Vérifie les logs :
```bash
docker compose ps
docker compose logs -f proxy api web
```

## 8) Publication des images (GHCR ou Docker Hub)

### Authentification
```bash
echo $GH_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```
ou
```bash
echo $DOCKERHUB_TOKEN | docker login -u DOCKERHUB_USER --password-stdin
```

### Build & push manuel
```bash
docker build -t ghcr.io/USERNAME/kot-api:latest ./kot-backend
docker push ghcr.io/USERNAME/kot-api:latest

docker build -t ghcr.io/USERNAME/kot-web:latest ./kot-frontend
docker push ghcr.io/USERNAME/kot-web:latest
```

## 9) CI/CD GitHub Actions (exemple)
Créer `.github/workflows/deploy.yml` :
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_TOKEN }}
      - name: Build & push API
        uses: docker/build-push-action@v5
        with:
          context: ./kot-backend
          tags: ghcr.io/${{ github.repository_owner }}/kot-api:latest
          push: true
      - name: Build & push Web
        uses: docker/build-push-action@v5
        with:
          context: ./kot-frontend
          tags: ghcr.io/${{ github.repository_owner }}/kot-web:latest
          push: true

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/kot
            git pull
            docker compose pull
            docker compose up -d --remove-orphans
```
- Stocker les secrets GitHub : `GHCR_TOKEN`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
- Si tu utilises Docker Hub, adapte le login et les tags.

## 10) Routine de mise à jour
1. Dev → `git push`.
2. GitHub Actions build & push les images.
3. Le job `deploy` lance `docker compose pull && docker compose up -d`.
4. Vérifie `docker compose ps` et les logs du proxy/api/web.

## 11) Maintenance & dépannage
- Logs : `docker compose logs -f proxy api web`.
- Redémarrer un service : `docker compose restart api`.
- Nettoyer les images inutilisées : `docker system prune -f`.
- Sauvegardes : monter des volumes pour la DB (`db_data`) et les sauvegarder régulièrement (dump ou snapshot).
- Monitoring simple : `docker stats`, ou installer `caddy metrics`/`prometheus` si besoin.

## 12) Checklist finale
- [ ] DNS LWS pointe vers l’IP du VPS.
- [ ] Fichiers `.env.production` présents sur le VPS (backend, frontend).
- [ ] `docker compose up -d` démarre sans erreur.
- [ ] Certificat TLS valide (via Caddy).
- [ ] Pipeline GitHub Actions vert, déploiement automatisé testé.

