# ADR-003: Tiered Spatial Architecture (PostGIS Ellipsoid Geofencing & Redis Geohash Radar)

## Status
**Accepted** (2026-09-19)

---

## Context & Problem Statement
Hyperlocal on-demand delivery requires handling two distinct geospatial query profiles:
1. **Persistent Boundary Geofencing**: Calculating whether a customer's address falls within a merchant's 3–10 km delivery radius during checkout.
2. **High-Frequency Courier Telemetry**: Ingesting GPS pings from hundreds of active riders every 3–5 seconds and discovering nearby riders within 3–5 km.

Writing frequent GPS ticks directly to PostgreSQL causes connection pool exhaustion, write lock contention, and WAL table bloat. Conversely, storing merchant polygons exclusively in application memory risks data loss on restart and fails in multi-process clusters.

---

## Decision Drivers
- **Ellipsoidal Accuracy**: Exact distance calculations over the WGS 84 ellipsoid (accounting for Earth's curvature) to prevent checkout false positives.
- **Microsecond Telemetry Lookup**: Discovering available couriers within radius in $<5$ ms.
- **Relational Write Isolation**: High-frequency location updates must not burden PostgreSQL disks.

---

## Considered Options
1. **All-in-PostgreSQL**: Store rider GPS pings directly into PostgreSQL via periodic updates. *(Rejected: Extreme write lock contention and table bloat)*.
2. **All-in-Application Memory**: Store locations in Node.js spatial indexing libraries (e.g. `rbush`). *(Rejected: Data loss on restarts, broken cross-process scaling)*.
3. **Tiered Spatial Architecture (PostGIS + Redis) (Chosen)**: PostGIS for ACID coverage boundary queries; Redis Geospatial indexing (`GEOADD`/`GEORADIUS`) for live fleet telemetry.

---

## Decision Outcome
Chosen option: **Tiered Spatial Architecture**.

| Layer | Technology | Primary Function | Data Structure / Query |
| :--- | :--- | :--- | :--- |
| **Tier 1: Relational Spatial Engine** | PostgreSQL 16 + PostGIS 3.4 | Authoritative store locations & customer delivery addresses | `geography(Point, 4326)` with GiST index<br/>`ST_DWithin(v.location, cust_pt, radius * 1000)` |
| **Tier 2: Volatile Telemetry Radar** | Redis 7.2 In-Memory Store | Live courier location tracking & nearby dispatch discovery | 52-bit integer Geohash indexing<br/>`GEOADD riders:locations:active <lon> <lat> <riderId>`<br/>`GEOSEARCH riders:locations:active FROMLONLAT <lon> <lat> BYRADIUS 5 km WITHDIST ASC` |

### Positive Consequences
- **Zero Planar Distortion**: Spherical math accurate to centimeter level worldwide.
- **Zero Disk Write Overhead for Pings**: High-frequency rider ticks are purely in-memory.
- **Instantaneous Dispatch**: Nearby rider radius discovery completes in under 1 ms.

### Negative Consequences & Mitigations
- *Trade-off*: Two spatial data layers must be maintained.
- *Mitigation*: Redis holds ephemeral telemetry only; PostgreSQL remains the sole source of truth for persistent entities.

---

## Technical Implementation Details
- PostGIS initialization script: [`deploy/init-postgis.sql`](../../deploy/init-postgis.sql):
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "postgis";
  ```
- Store geofence validation: [`vendor.service.ts`](../../services/backend_api/src/modules/vendors/vendor.service.ts).
- Realtime telemetry gateway: [`tracking.gateway.ts`](../../services/backend_api/src/modules/realtime/tracking.gateway.ts).

---

## Compliance & Verification
- PostGIS verification: Database initialization scripts verify spatial GiST indexes.
- Telemetry verification: [`test-admin-console.ts`](../../apps/admin_portal/scripts/test-admin-console.ts) validates real-time fleet radar coordinates.
