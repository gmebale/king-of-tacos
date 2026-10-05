FROM node:20-alpine AS base
WORKDIR /app

# Prisma needs OpenSSL at runtime
RUN apk add --no-cache openssl netcat-openbsd

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

# Wait for MySQL, then start the API without changing the schema or seeding data.
CMD ["sh", "-c", "echo 'Waiting for MySQL...' && i=0; until nc -z host.docker.internal 3306; do i=$((i+1)); if [ \"$i\" -ge 60 ]; then echo 'MySQL not ready after 60s'; exit 1; fi; sleep 1; done && echo 'MySQL is up' && npm start"]

