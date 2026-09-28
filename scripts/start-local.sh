#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — Localhost System Launcher Script
# Task 7.2: Start and Manage DeliveryOS Services on Localhost
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-}"

echo "=================================================================="
echo " DeliveryOS Localhost Launcher"
echo "=================================================================="

if [ "$MODE" == "--stop" ]; then
  echo "🛑 Stopping all DeliveryOS local containers..."
  docker compose --env-file "$PROJECT_ROOT/.env" -f "$PROJECT_ROOT/deploy/docker-compose.yml" down 2>/dev/null || true
  echo "✅ All containers stopped."
  exit 0
fi

if [ "$MODE" == "--docker" ]; then
  echo "🚀 Launching complete 6-container Docker stack (DB, Redis, Backend, Admin Portal, Vendor Portal, Nginx)..."
  docker compose --env-file "$PROJECT_ROOT/.env" -f "$PROJECT_ROOT/deploy/docker-compose.yml" up -d --build
  echo ""
  echo "Waiting 5 seconds for services to initialize..."
  sleep 5
  "$SCRIPT_DIR/verify-local.sh"
  exit 0
fi

# Default: Ensure core database & cache containers are up
echo "🐘 Starting core PostgreSQL (PostGIS) & Redis containers..."
docker compose --env-file "$PROJECT_ROOT/.env" -f "$PROJECT_ROOT/deploy/docker-compose.yml" up -d postgres redis

echo ""
echo "Waiting for services to become healthy..."
sleep 3

"$SCRIPT_DIR/verify-local.sh"

echo ""
echo "=================================================================="
echo " 🌟 Next Steps to run locally on your host machine:"
echo "=================================================================="
echo " 1. Start Backend API (Port 4000):
    cd services/backend_api && npm run start:dev
    • Health Check: http://localhost:4000/api/v1/health
    • Swagger Docs: http://localhost:4000/docs

 2. Start Super Admin Portal (Port 3000):
    cd apps/admin_portal && npm run dev
    • Open Admin Portal: http://localhost:3000

 3. Start Vendor Store & Kitchen Portal (Port 3001):
    cd apps/vendor_portal && npm run dev
    • Open Vendor Portal: http://localhost:3001

 4. Or to run the complete 6-container stack inside Docker (with Nginx proxy on 8080):
    ./scripts/start-local.sh --docker
=================================================================="
