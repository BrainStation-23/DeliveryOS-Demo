# ADR-015: Horizontal-Scaling Readiness for the Single-VPS Topology

## Status
**Accepted** (2026-09-28)

---

## Context & Problem Statement
The platform runs as a single backend replica, and three details hard-locked it to one instance:

1. The Socket.IO gateway kept room state in-process — with two replicas, events emitted on replica A never reached sockets connected to replica B.
2. Background sweeps (unpaid-payment expiry, dispatch escalation) ran in every replica's process — duplication would double-cancel orders and double-escalate.
3. `container_name` pins in the production compose file prevented `docker compose --scale` outright.

Launch traffic fits one replica, but a flash sale or rider-fleet growth must not require a rewrite under pressure.

---

## Decision

- **Socket.IO Redis adapter** (`@socket.io/redis-adapter`): the gateway attaches the adapter in `afterInit` using two dedicated pub/sub connections duplicated from the shared Redis client (pub/sub clients cannot share the command connection). Events now fan out across replicas; the setup is a no-op behaviorally at one replica.
- **Leader-locked sweeps**: each sweep tick acquires a short-TTL Redis lock (`lock:sweep:expired-payments` 55s, `lock:sweep:dispatch-escalation` 25s) using a per-instance UUID as the lock value. Exactly one replica executes per tick; the rest skip silently.
- **Prod compose de-pinned**: `container_name` entries removed from `docker-compose.prod.yml` so `--scale backend=N` works; service-DNS names (which compose already provides) are used everywhere. The dev compose keeps names because local helper scripts (`backup-db.sh`/`restore-db.sh`) target them by name (overridable via `DB_CONTAINER`).
- **JWT user-lookup cache**: the auth guard caches the user + relations in Redis for 30 seconds per request subject, removing the per-request Postgres hit that would otherwise dominate replica load. Role/status revocations propagate within the TTL — an accepted trade-off (the same session revocation class is already bounded by the 15-minute access token from ADR-013).

---

## Consequences

**Positive**
- A second backend replica is now a `--scale backend=2` command plus a load balancer, not a project.
- Duplicate sweeps and split-brain dispatch escalation are structurally prevented.
- Per-request DB load drops materially under token-heavy mobile traffic.

**Negative / Trade-offs**
- Role/status changes take up to 30s to affect already-cached sessions (documented; suspend/OTP-revocation flows unaffected).
- Two extra Redis connections per replica for adapter pub/sub.
- The prod compose no longer exposes stable container names — operational scripts must use `docker compose exec` / service names or set `DB_CONTAINER`.

## Related
- [Production Readiness Plan — Wave 4](../../docs/PRODUCTION_READINESS_PLAN.md)
- [ADR-004](./ADR-004-atomic-dispatch-claim-mutex.md) (the same Redis lock pattern now guards sweeps)
- [ADR-012](./ADR-012-production-security-hardening-and-fail-fast-config.md) (required-`REDIS_URL` posture)
