# Multi-stage Dockerfile for DeliveryOS Backend API
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for alpine
RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma engine binary compatibility
RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
