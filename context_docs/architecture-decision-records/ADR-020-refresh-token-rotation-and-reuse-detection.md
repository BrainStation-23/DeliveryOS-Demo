# ADR-020: Refresh Token Rotation, Reuse Detection, and Mobile Revocation Posture

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: Platform Architecture Board, Security Engineering
- **Related**: [ADR-012](./ADR-012-production-security-hardening-and-fail-fast-config.md) (token families), [ADR-013](./ADR-013-real-world-integration-stack.md) (auth stack)

## Context

Prior to this hardening, a refresh token compromised in transit or exfiltrated from client storage could potentially be used concurrently with legitimate client sessions without detection. Furthermore, when unrecoverable refresh failures (401 invalid/expired token) occurred on mobile clients (Customer and Rider Flutter apps), the absence of a proactive session eviction handler could leave clients in an indeterminate degraded loop.

## Decision

1. **Strict Refresh Token Rotation with JTI Revocation in Redis**:
   - Every refresh request (`POST /auth/token/refresh`) issues a new access token AND a new rotating refresh token.
   - The previously used `jti` is immediately blacklisted in Redis (`blacklist:refresh:<jti>`) with an expiration matching the token's lifetime.
2. **Token Family Reuse Detection**:
   - If an already-revoked refresh token is presented, the system treats it as an active session hijack attempt:
     - The entire active token family for that user is immediately revoked in Redis.
     - The request is rejected with `401 Unauthorized`.
3. **Single-Flight Concurrency Lock**:
   - Frontend web portals (`admin_portal` and `vendor_portal`) use a single-flight mutex around token refresh to prevent concurrent requests from triggering false reuse detection.
4. **Mobile Revocation & Session Eviction Posture**:
   - Both Flutter apps (`customer_app` and `rider_app`) implement an `onSessionExpired` interceptor callback that clears local secure storage and resets app navigation directly to the phone login screen upon unrecoverable 401 refresh responses.

## Consequences

- Compromised refresh tokens are rendered useless after a single use.
- Replayed tokens trigger immediate family revocation, protecting user accounts.
- Mobile devices handle expired sessions gracefully without hanging or repeatedly failing API calls.
