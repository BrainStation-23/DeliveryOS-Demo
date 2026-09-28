#!/usr/bin/env bash
# ==============================================================================
# DeliveryOS — Android Release Build (AAB for Play Store)
# Usage:
#   ./scripts/build-android.sh customer            # customer app AAB
#   ./scripts/build-android.sh rider               # rider app AAB
# Env (required for release builds):
#   API_BASE_URL / SOCKET_BASE_URL   staging or prod API origin
#   GOOGLE_MAPS_API_KEY              Maps SDK key (customer app)
#   FIREBASE_API_KEY/APP_ID/SENDER_ID/PROJECT_ID   push config
#   SENTRY_DSN                       optional error monitoring
# Prereq: apps/<app>/android/key.properties + keystore (see docs/RELEASE.md)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-}"
case "$TARGET" in
  customer) APP_DIR="$PROJECT_ROOT/apps/customer_app" ;;
  rider) APP_DIR="$PROJECT_ROOT/apps/rider_app" ;;
  *)
    echo "Usage: $0 [customer|rider]" >&2
    exit 1
    ;;
esac

: "${API_BASE_URL:?API_BASE_URL is required (e.g. https://api.deliveryos.example.com/api/v1)}"
: "${SOCKET_BASE_URL:=${API_BASE_URL%/api/v1}}"

if [ ! -f "$APP_DIR/android/key.properties" ]; then
  echo "WARNING: $APP_DIR/android/key.properties missing — the AAB will be DEBUG-signed and is not uploadable to Play." >&2
fi

DEXTRA=()
[[ -n "${API_BASE_URL:-}" ]] && DEXTRA+=(--dart-define=API_BASE_URL="$API_BASE_URL")
[[ -n "${SOCKET_BASE_URL:-}" ]] && DEXTRA+=(--dart-define=SOCKET_BASE_URL="$SOCKET_BASE_URL")
[[ -n "${GOOGLE_MAPS_API_KEY:-}" ]] && DEXTRA+=(--dart-define=GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY")
[[ -n "${PAYMENT_GATEWAY:-}" ]] && DEXTRA+=(--dart-define=PAYMENT_GATEWAY="$PAYMENT_GATEWAY")
[[ -n "${FIREBASE_API_KEY:-}" ]] && DEXTRA+=(--dart-define=FIREBASE_API_KEY="$FIREBASE_API_KEY")
[[ -n "${FIREBASE_APP_ID:-}" ]] && DEXTRA+=(--dart-define=FIREBASE_APP_ID="$FIREBASE_APP_ID")
[[ -n "${FIREBASE_SENDER_ID:-}" ]] && DEXTRA+=(--dart-define=FIREBASE_SENDER_ID="$FIREBASE_SENDER_ID")
[[ -n "${FIREBASE_PROJECT_ID:-}" ]] && DEXTRA+=(--dart-define=FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID")
[[ -n "${SENTRY_DSN:-}" ]] && DEXTRA+=(--dart-define=SENTRY_DSN="$SENTRY_DSN")

cd "$APP_DIR"
flutter build appbundle --release "${DEXTRA[@]}"
echo ""
echo "✅ AAB ready: build/app/outputs/bundle/release/app-release.aab"
