# Multi-stage Dockerfile for DeliveryOS Web Portal (Vite + Nginx)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# ------------------------------------------------------------------------------
# Production Static Serving Stage (non-root nginx, listens on 8080)
# ------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.25-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/vendor
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
