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

# Run migrations before starting the API
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]

