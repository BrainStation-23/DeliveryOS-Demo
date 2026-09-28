#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — Localhost System Verification Script
# Task 7.2: Verify All Local Services & Endpoints
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================================="
echo " DeliveryOS Localhost System Verification"
echo "=================================================================="

# 1. Check Docker Daemon
echo -n "🐳 Checking Docker daemon... "
if docker info > /dev/null 2>&1; then
  echo "✅ Running"
else
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

# 2. Check PostgreSQL + PostGIS (Port 5433)
echo -n "🐘 Checking PostgreSQL + PostGIS (Port 5433)... "
if docker exec deliveryos_db pg_isready -U postgres -d deliveryos > /dev/null 2>&1; then
  echo "✅ Healthy (deliveryos_db up on port 5433)"
else
  echo "❌ PostgreSQL not responding on port 5433"
fi

# 3. Check Redis 7.2 (Port 6380)
echo -n "⚡ Checking Redis 7.2 In-Memory Cache (Port 6380)... "
if [ -z "${REDIS_PASSWORD:-}" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  REDIS_PASSWORD="$(grep -E '^REDIS_PASSWORD=' "$PROJECT_ROOT/.env" | cut -d= -f2-)"
fi
PONG=$(docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD:-}" deliveryos_redis redis-cli ping 2>/dev/null || echo "FAIL")
if [[ "$PONG" == *"PONG"* ]]; then
  echo "✅ Healthy (deliveryos_redis up on port 6380)"
else
  echo "❌ Redis not responding on port 6380"
fi

# 4. Check Backend API (Port 4000)
echo -n "🚀 Checking Backend API Health (http://localhost:4000/api/v1/health)... "
HEALTH_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/health 2>/dev/null || echo "DOWN")
if [ "$HEALTH_RESP" == "200" ]; then
  HEALTH_BODY=$(curl -s http://localhost:4000/api/v1/health 2>/dev/null)
  echo "✅ 200 OK"
  echo "   Response: $HEALTH_BODY"
else
  echo "⚠️ Not reachable on port 4000 (status: $HEALTH_RESP)"
  echo "   (Start backend with: npm --prefix services/backend_api run start:dev or via deploy/docker-compose.yml)"
fi

# 5. Check Super Admin Portal (Port 3000)
echo -n "🛡️ Checking Super Admin Portal (http://localhost:3000)... "
ADMIN_PORTAL_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "DOWN")
if [ "$ADMIN_PORTAL_RESP" == "200" ]; then
  echo "✅ 200 OK (Admin Portal active on port 3000)"
else
  echo "⚠️ Not reachable on port 3000 (status: $ADMIN_PORTAL_RESP)"
  echo "   (Start admin portal with: npm --prefix apps/admin_portal run dev or via deploy/docker-compose.yml)"
fi

# 6. Check Vendor Store & Kitchen Portal (Port 3001)
echo -n "🏪 Checking Vendor Kitchen Portal (http://localhost:3001)... "
VENDOR_PORTAL_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "DOWN")
if [ "$VENDOR_PORTAL_RESP" == "200" ]; then
  echo "✅ 200 OK (Vendor Portal active on port 3001)"
else
  echo "⚠️ Not reachable on port 3001 (status: $VENDOR_PORTAL_RESP)"
  echo "   (Start vendor portal with: npm --prefix apps/vendor_portal run dev or via deploy/docker-compose.yml)"
fi

# 7. Check Edge Nginx Reverse Proxy (Port 8080)
echo -n "🌐 Checking Edge Nginx Reverse Proxy (http://localhost:8080/api/v1/health)... "
PROXY_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/health 2>/dev/null || echo "DOWN")
if [ "$PROXY_RESP" == "200" ]; then
  echo "✅ 200 OK (Reverse Proxy routing successfully)"
else
  echo "⚠️ Not running on port 8080 (optional when using host dev servers)"
fi

echo "=================================================================="
echo " Verification Check Finished!"
echo "=================================================================="
