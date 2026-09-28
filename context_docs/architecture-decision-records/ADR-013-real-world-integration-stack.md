# ADR-013: Real-World Integration Stack — SMS, SSLCommerz, FCM Push, Token Rotation & Background Telemetry

## Status
**Accepted** (2026-09-28)

---

## Context & Problem Statement
Wave 2 of the [Production Readiness Plan](../../docs/PRODUCTION_READINESS_PLAN.md) found that the platform's three load-bearing external loops were simulated:

1. **Authentication had no lifecycle**: refresh tokens were issued but never usable (no `/auth/refresh`), access tokens lived for 7 days, and mobile clients stored them in plaintext `SharedPreferences`.
2. **Payments were fabricated end-to-end**: the SSLCommerz adapter invented transaction IDs and payment URLs, its webhook "verification" was a homemade MD5 that did not match the gateway's real scheme, and concurrent IPN replays could double-run side effects. Cancelling a PAID order only flipped a DB flag — no money ever moved.
3. **Push notifications were log lines**: `firebase-admin` was never installed; rider dispatch alerts only existed while the rider app was foregrounded with an open socket, and the rider GPS stream fabricated synthetic Dhaka coordinates whenever the device GPS errored.

---

## Decision

### 1. SMS Providers Behind the Existing `SMS_SERVICE` Token
- `SMS_PROVIDER` selects the transport: `mock` (dev default) or `ssl_wireless` (SMS Plus v3, Bangladesh). The real provider makes live HTTP calls with lazily-read credentials (`SMS_SSLW_API_TOKEN`/`SMS_SSLW_SID`); additional transports can be added behind the same token when needed.
- OTP lifetime shortened to 2 minutes; verification is locked after 5 failed attempts per code.

### 2. Refresh Token Rotation with a Revocation Store
- `POST /auth/refresh` validates the refresh JWT (`type: 'refresh'`, `jti`), checks the Redis revocation store (`auth:refresh:<jti>`), revokes the presented token, and issues a rotated pair. `POST /auth/logout` revokes server-side.
- Access tokens default to **15 minutes**; refresh tokens to 30 days. The JWT guard rejects refresh tokens used as access tokens.
- All four clients recover transparently: web portals run a single-flight 401 refresh-and-replay interceptor with an expiry check at boot; Flutter apps rotate inside the Dio `onError` interceptor and persist tokens in `flutter_secure_storage` (Keystore/Keychain), migrating away from plaintext.

### 3. Real SSLCommerz Integration (Single Gateway)
- Per the anti-over-engineering ground rules the platform integrates **one** gateway: SSLCommerz Session/Validator APIs (bKash adapter removed; re-adding follows the ADR-011 adapter pattern).
- `initiatePayment` creates a real session and returns the hosted `GatewayPageURL`; webhooks are verified **server-to-server** via the Order Validation API (`val_id`) or TrxID API — fail-closed without credentials; refunds call the real Refund API using the gateway `bank_tran_id` captured during webhook validation.
- The IPN handler claims the `PENDING → PAID/FAILED` transition with a guarded `updateMany` **inside** the transaction, so concurrent replays cannot double-process.
- Cancellation of a PAID order executes the gateway refund **before** the DB reconciliation; a failed refund aborts the cancellation with a `REFUND_FAILED` (502) so operators see the gateway error. Refund references persist in `payments.refund_id` / `refunded_at`.
- The sandbox simulator remains a dev-only adapter (rejected in production) and simulates refunds for local flows.

### 4. Real FCM Push
- `firebase-admin` initializes lazily from `FIREBASE_SERVICE_ACCOUNT_JSON` (inline) or `FIREBASE_SERVICE_ACCOUNT` (path); without it, dispatch degrades to structured log-only so development needs no Firebase project.
- Both Flutter apps initialize Firebase from `--dart-define` options (no `google-services.json` required), request permission, register the device token (`POST /auth/device-token`), and route notification taps to the order tracking screen (customer).
- Critical events already wired: dispatch broadcast (riders), rider assignment + payment verification (customer), order status changes.

### 5. Real Rider Telemetry
- A foreground service (`flutter_background_service`) keeps GPS fixes flowing while the phone is pocketed; fixes are forwarded to the main isolate and follow the same socket + throttled (≥30s) HTTP path.
- The synthetic-coordinate fallback was **deleted**: GPS failures now surface as a status message, never as fabricated telemetry.
- App lifecycle handling reconnects the socket and resumes beaconing on foreground.

### 6. Environment Injection for Mobile Builds
- Base URLs, socket URL, payment gateway, Maps key, and Firebase options are injected via `--dart-define` (no localhost URLs in release builds); `GOOGLE_MAPS_API_KEY` must be provided for release map rendering.

---

## Consequences

**Positive**
- Login, payment, refund, dispatch, and tracking are exercised against real third-party systems in production; token theft exposure drops from a 7-day plaintext window to a 15-minute Keystore-backed token.
- Webhook replays and cancellation races are structurally impossible to double-settle.
- Riders receive dispatch alerts with the app backgrounded; customer tracking no longer receives fabricated positions.

**Negative / Trade-offs**
- Production now requires real credentials (SSLCommerz, SMS provider, Firebase service account) — the fail-fast config from ADR-012 enforces this.
- 15-minute access tokens make an offline client silently re-authenticate on its first call after expiry (handled transparently by all clients).
- The foreground service adds a persistent notification (required by Android for background location).
- Flutter unit tests skip platform channels (secure storage and background service degrade to in-memory/no-op paths).

## Related
- [Production Readiness Plan — Wave 2](../../docs/PRODUCTION_READINESS_PLAN.md)
- [ADR-011](./ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md) (payment-gated dispatch invariant, now backed by a real gateway)
- [ADR-012](./ADR-012-production-security-hardening-and-fail-fast-config.md) (fail-closed webhook posture)
