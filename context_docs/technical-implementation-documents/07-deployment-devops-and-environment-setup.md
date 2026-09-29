# 07 — DevOps, Docker & Environment Setup

Deployment topology, Docker Compose services, Nginx subpath routing configuration, environment variables specification, and database initialization for DeliveryOS.

---

## 1. Docker Compose Multi-Container Topology

```yaml
# deploy/docker-compose.yml
version: '3.8'

services:
  # 1. PostgreSQL 16 with PostGIS 3.4
  postgres:
    image: postgis/postgis:16-3.4-alpine
    container_name: deliveryos_db
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME:-deliveryos}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secretpassword}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-postgis.sql:/docker-entrypoint-initdb.d/10-postgis.sql
    ports:
      - "127.0.0.1:${DB_PORT:-5433}:5432"
    networks:
      - deliveryos_network

  # 2. Redis 7.2 Cache & Pub/Sub
  redis:
    image: redis:7.2-alpine
    container_name: deliveryos_redis
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redispassword}
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:${REDIS_PORT:-6380}:6379"
    networks:
      - deliveryos_network

  # 3. NestJS Backend API
  backend:
    build:
      context: ../services/backend_api
      dockerfile: Dockerfile
    container_name: deliveryos_api
    restart: always
    depends_on:
      - postgres
      - redis
    env_file:
      - ../.env
    ports:
      - "4000:4000"
    networks:
      - deliveryos_network

  # 4. Super Admin Master Console (Vite + Nginx)
  admin_portal:
    build:
      context: ../apps/admin_portal
      dockerfile: Dockerfile
    container_name: deliveryos_admin_portal
    restart: always
    ports:
      - "3000:80"
    networks:
      - deliveryos_network

  # 5. Vendor Store & Kitchen Console KDS (Vite + Nginx)
  vendor_portal:
    build:
      context: ../apps/vendor_portal
      dockerfile: Dockerfile
    container_name: deliveryos_vendor_portal
    restart: always
    ports:
      - "3001:80"
    networks:
      - deliveryos_network

  # 6. Edge Nginx Reverse Proxy
  nginx:
    image: nginx:1.25-alpine
    container_name: deliveryos_nginx
    restart: always
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - backend
      - admin_portal
      - vendor_portal
    networks:
      - deliveryos_network

volumes:
  pgdata:
  redisdata:

networks:
  deliveryos_network:
    driver: bridge
```

---

## 2. Nginx Subpath Reverse Proxy Configuration (ADR-005)

```nginx
# deploy/nginx.conf
events { worker_connections 1024; }

http {
    upstream backend_api {
        server backend:4000;
    }
    upstream admin_portal_svc {
        server admin_portal:80;
    }
    upstream vendor_portal_svc {
        server vendor_portal:80;
    }

    server {
        listen 80;
        server_name api.deliveryos.local portal.deliveryos.local localhost;

        # Super Admin Web Portal (Root Path /)
        location / {
            proxy_pass http://admin_portal_svc;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Vendor KDS Web Portal (Subpath /vendor/)
        location /vendor/ {
            proxy_pass http://vendor_portal_svc;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Backend REST API
        location /api/v1/ {
            proxy_pass http://backend_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # WebSocket Gateway
        location /events/ {
            proxy_pass http://backend_api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

---

## 3. Environment Variables Specification (`.env.example`)

```bash
# Node & Application Runtime
NODE_ENV=production
PORT=4000

# Database (PostgreSQL + PostGIS)
DB_HOST="localhost"
DB_PORT=5433
DB_NAME="deliveryos"
DB_USER="postgres"
DB_PASSWORD="secretpassword"
DATABASE_URL="postgresql://postgres:secretpassword@localhost:5433/deliveryos?schema=public"

# Redis In-Memory Cache & Pub/Sub
REDIS_HOST="localhost"
REDIS_PORT=6380
REDIS_PASSWORD="redispassword"

# JWT Authentication Secrets
JWT_ACCESS_SECRET="super-secret-access-token-key-min-32-chars-long"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_SECRET="super-secret-refresh-token-key-min-32-chars-long"
JWT_REFRESH_EXPIRATION="30d"

# Regional Settings & CORS
REGION_MODE="BD" # "BD" (Asia/Dhaka) | "KSA" (Asia/Riyadh)
DEFAULT_CURRENCY="BDT"
CURRENCY_SYMBOL="৳"
CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:8080"
SWAGGER_ENABLED=false

# Default Delivery Fee Settings
DELIVERY_FEE_MODE="FIXED_FLAT" # "FIXED_FLAT" | "DISTANCE_TIERED"
FLAT_DELIVERY_FEE=50.0
BASE_DELIVERY_FEE=30.0
BASE_DELIVERY_KM=2.0
PER_KM_DELIVERY_RATE=10.0

# Order Fulfillment Sequence Flow
ORDER_FLOW_MODE="RIDER_FIRST" # "RIDER_FIRST" (Zero Food Waste) | "VENDOR_FIRST"
RIDER_SEARCH_TIMEOUT_SECONDS=90

# Google Maps API
GOOGLE_MAPS_API_KEY="AIzaSy..."

# Online Payment Gateway (SSLCommerz)
PAYMENT_GATEWAY="SSLCOMMERZ" # "SSLCOMMERZ" | "SANDBOX"
SSLCOMMERZ_STORE_ID="deliveryos_live"
SSLCOMMERZ_STORE_PASSWORD="password"
SSLCOMMERZ_IS_LIVE=false

# Push Notifications (Firebase Admin SDK)
FIREBASE_PROJECT_ID="deliveryos-prod"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@deliveryos-prod.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqh..."

# SMS Gateway (SSL Wireless / Mock)
SMS_PROVIDER="ssl_wireless" # "ssl_wireless" | "mock"
SMS_SSLW_API_TOKEN="..."
SMS_SSLW_SID="..."

# Error Monitoring (Sentry)
SENTRY_DSN="https://...@sentry.io/..."
```

---

## 4. PostGIS Initialization Script

```sql
-- deploy/init-postgis.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";
```

---

## 5. Seed Data Strategy for 10 Pilot Vendors

When initializing the database for the pilot, the seed script (`services/backend_api/prisma/seed.ts`) populates:
1. **1 Super Admin Account** (`admin@deliveryos.local` / `+8801700000000`).
2. **10 Pilot Vendors** (7 restaurants/cafes, 3 super shops/groceries) complete with coordinates, operating hours, categories, dishes, variants, and add-ons.
3. **5 Pre-Approved Pilot Riders** with mock GPS coordinates within the pilot radius.
4. **Default System Settings** (`FIXED_FLAT` fee mode at 50 BDT / 12 SAR; `RIDER_FIRST` FSM mode).

---

## 6. Mobile App Release Engineering & Signing

Covers the production release pipeline for `apps/customer_app` and `apps/rider_app`.

### 6.1. Signing Keystore & Configuration
1. **Generate Release Keystore** (stored securely off-repo):
   ```bash
   keytool -genkey -v -keystore ~/deliveryos-release.keystore -alias deliveryos -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Configure `key.properties`** in `apps/<app>/android/key.properties` (gitignored):
   ```properties
   storePassword=<keystore-password>
   keyPassword=<key-password>
   keyAlias=deliveryos
   storeFile=/absolute/path/to/deliveryos-release.keystore
   ```
   *Note: If missing, release builds fall back to debug signing for safe local checkouts.*

### 6.2. Production AAB Generation
Execute `scripts/build-android.sh` with required environment variables injected via `--dart-define`:
```bash
export API_BASE_URL="https://api.deliveryos.example.com/api/v1"
export GOOGLE_MAPS_API_KEY="AIza..."            # Customer app
export FIREBASE_API_KEY="..." FIREBASE_APP_ID="..." FIREBASE_SENDER_ID="..." FIREBASE_PROJECT_ID="..."
export SENTRY_DSN="https://..."                 # Optional error monitoring

./scripts/build-android.sh customer   # Outputs: apps/customer_app/build/app/outputs/bundle/release/app-release.aab
./scripts/build-android.sh rider      # Outputs: apps/rider_app/build/app/outputs/bundle/release/app-release.aab
```

### 6.3. Pre-Upload Verification & Play Console Disclosures
- **Verification**: Verify signature (`jarsigner -verify -certs -verbose app-release.aab`) and version bumps (`version: x.y.z+n` in `pubspec.yaml`).
- **Foreground Service & Location Disclosure**: Rider app collects foreground-service GPS during active shift duty (`location` type declared). In-app disclosure modal is presented before duty activation.
- **Two Environments Only**: Dev (local Docker) and Production. Play Store Internal Track serves as pre-production validation against live backend APIs.
- **iOS Releases**: Runner targets exist; requires Apple Developer certificate profile and `flutter build ipa`.

