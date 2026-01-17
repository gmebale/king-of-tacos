FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time variables for CRA
ARG REACT_APP_API_URL
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY

# Supprimer tous les fichiers .env pour éviter qu'ils écrasent les ARG
RUN rm -f .env .env.local .env.production .env.production.local .env.development .env.development.local 2>/dev/null || true

# Afficher la valeur pour debug (sans exposer les secrets complets)
RUN echo "Building with REACT_APP_API_URL=${REACT_APP_API_URL}"

ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=${REACT_APP_STRIPE_PUBLISHABLE_KEY}

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

