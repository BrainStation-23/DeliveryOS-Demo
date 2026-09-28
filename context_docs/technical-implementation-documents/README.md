# Technical Implementation Documents (TID) Suite
### DeliveryOS — Engineering Specifications & AI Agent Implementation Guide

Authoritative technical blueprints, relational database schemas, REST API contracts, Socket.IO protocols, state machines, frontend architectures, and DevOps topologies for DeliveryOS.

---

## 1. Document Index

- **[01-system-architecture-and-tech-stack.md](./01-system-architecture-and-tech-stack.md)** — **System Architecture & Tech Stack**: Ingress topology, component diagram, technology versions, monorepo directory tree, and role-based security boundaries.
- **[02-database-schema-and-data-models.md](./02-database-schema-and-data-models.md)** — **Database Schema & Data Models**: Relational ERD, 22-table data dictionary, PostgreSQL 16 DDL, PostGIS GiST spatial indexes, and spatial boundary queries.
- **[03-api-specifications-and-endpoints.md](./03-api-specifications-and-endpoints.md)** — **API Specifications & Endpoints**: Global JSON response envelopes, RESTful contracts, DTO schemas, and RBAC guards across all modules.
- **[04-realtime-events-and-websocket-protocol.md](./04-realtime-events-and-websocket-protocol.md)** — **Real-Time WebSockets & Event Protocol**: Socket.IO gateway, JWT handshake, room subscription matrix, event payload catalog, and reconnection reconciliation.
- **[05-order-state-machine-and-dispatch-engine.md](./05-order-state-machine-and-dispatch-engine.md)** — **Order State Machine & Dispatch Engine**: Dual-flow FSM (`RIDER_FIRST` vs `VENDOR_FIRST`), transition matrix, Redis proximity radius queries, distributed mutex claim lock, and double-entry accounting formulas.
- **[06-frontend-and-mobile-architecture.md](./06-frontend-and-mobile-architecture.md)** — **Frontend & Mobile Architecture**: Feature-first Riverpod Flutter apps (Customer & Rider), native phone/maps handoffs, React 18 SPA route registries, Web Audio API oscillator chime synthesis, and Leaflet radar map.
- **[07-deployment-devops-and-environment-setup.md](./07-deployment-devops-and-environment-setup.md)** — **DevOps, Docker & Environment Setup**: Docker Compose multi-container stack, Nginx subpath reverse proxy routing, `.env.example` specifications, PostGIS initialization, and 10-vendor seed strategy.

---

## 2. Granular Technical Component & Protocol Catalog

### 2.1 Backend Core Services & Ingress
- **Nginx Edge Ingress**: Port 8080 reverse proxy routing root `/` to Admin Portal, `/vendor/` to Vendor Portal, `/api/v1/` to NestJS REST, and `/events/` to WebSocket Gateway.
- **NestJS REST API**: Modular TypeScript backend on Node.js 20 LTS enforcing global validation pipes, standardized JSON envelopes, and JWT authentication guards.
- **Socket.IO Real-Time Gateway**: Real-time event gateway with room subscriptions (`user_`, `vendor_`, `rider_`, `order_`, `admin_hq`, `admin_fleet`) backed by Redis Pub/Sub adapter.

### 2.2 Data Persistence & Spatial Engine
- **Relational ACID Storage**: PostgreSQL 16 enforcing strict relational integrity, UUID primary keys, and transaction-wrapped order creation.
- **PostGIS Spatial Engine**: Native spatial data types (`GEOGRAPHY(Point, 4326)`) and GiST spatial indexes enabling sub-millisecond radius checks (`ST_DWithin`) and distance calculation (`ST_Distance`).
- **Redis In-Memory Engine**: Redis 7.2 handling high-frequency courier GPS coordinates (`GEOADD`, `GEOSEARCH`), 10-second atomic mutex claim locks (`SET NX EX 10`), and order numbering counters.

### 2.3 Order Lifecycle & Dispatch Engine
- **Configurable FSM Sequences**: Dual-mode state machine governed by `order_flow_mode`:
  - `RIDER_FIRST`: Secures courier lock before notifying kitchen (Zero Food Waste Mode).
  - `VENDOR_FIRST`: Notifies kitchen upon checkout; broadcasts to couriers after packaging.
- **Direct Preparation Transition**: Runtime transition directly to `PREPARING` upon store acceptance, deprecating intermediate legacy state `ACCEPTED`.
- **Payment-Gated Invariant**: Online orders remain in `PLACED` state until cryptographic webhook confirms `paymentStatus === PAID` before dispatch broadcast.
- **Dispatch Escalation**: Automated radius expansion from 3 km (Tier 0) ➔ 6 km (Tier 1, 45s) ➔ 10 km and Admin Radar alert (Tier 2, 90s).

### 2.4 Mobile Client Applications (Flutter 3.19+)
- **Customer Application**: Map pin location picker, single-vendor cart isolation, geofence radius protection, coupon engine, live tracking stepper, native phone dialer handoff (`tel:`), and 1-tap re-order.
- **Rider Application**: Shift duty toggle with in-flight lock, 45-second proximity broadcast claim modal with heavy haptic impact, 3-step fulfillment workflow, native GPS navigation handoff, 5-minute unresponsive customer SOP, and cash safety limit.

### 2.5 Web Single Page Applications (React 18 + Vite)
- **Super Admin Console (`apps/admin_portal`)**: Leaflet OpenStreetMap interactive fleet radar, applicant verification queue, force-assign and force-cancel order modals, master catalog authority, and RFC 4180 CSV settlement exports.
- **Vendor Kitchen Console (`apps/vendor_portal`)**: 3-lane KDS Kanban board, Web Audio API in-memory dual-tone chime (587 Hz + 880 Hz), catalog stock toggles retaining sold-out items, rush hour pause, and daily sales receipts.
- **Subpath Isolation**: Micro-frontend routing via Nginx (`/` for Admin, `/vendor/` for Vendor) avoiding cross-tenant asset pollution.

### 2.6 Accounting & Financial Integrity
- **Double-Entry Ledgers**: Atomic creation of `CommissionLedger` (gross volume, platform commission, net vendor payable) and `RiderTripLedger` (trip remuneration, collected COD cash).
- **COD Offset Engine**: Verified physical hub cash deposits (`POST /riders/deposit-cash`) decrement courier `cashInHand` and restore dispatch eligibility.
