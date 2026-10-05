#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — Database Seeding Script
# Usage:
#   ./scripts/seed-database.sh            # Baseline seeding
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================================="
echo " DeliveryOS Database Seeder"
echo "=================================================================="

echo "🌱 Running Baseline Seeder..."
npm --prefix "$PROJECT_ROOT/services/backend_api" run prisma:seed

echo ""
echo "✅ Seeding Complete! Verifying system health..."
"$SCRIPT_DIR/verify-local.sh"
