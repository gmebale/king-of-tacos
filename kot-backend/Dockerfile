FROM node:20-alpine AS base
WORKDIR /app

# Prisma needs OpenSSL at runtime
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

# Install only production deps and generate Prisma client
RUN npm ci --omit=dev
RUN npx prisma generate

# Copy the rest of the source
COPY . .
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Demo: Wait for MySQL + migrate + seed + dev server
CMD ["sh", "-c", "apk add --no-cache netcat-openbsd >/dev/null 2>&1 && echo 'Waiting for MySQL...' && i=0; until nc -z host.docker.internal 3306; do i=$((i+1)); if [ \"$i\" -ge 60 ]; then echo 'MySQL not ready after 60s'; exit 1; fi; sleep 1; done && echo 'MySQL is up' && npx prisma db push --accept-data-loss && npx prisma generate && node seed.js && echo 'Demo ready! Admin: admin@test.com / password123' && npm start"]

