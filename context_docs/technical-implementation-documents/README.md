# Technical Implementation Documents (TID) Suite
### DeliveryOS — Engineering Specifications & AI Agent Implementation Guide

Authoritative technical blueprints, relational database schemas, REST API contracts, Socket.IO protocols, state machines, frontend architectures, and DevOps topologies for DeliveryOS.

---

## 1. Document Index

- **[01-system-architecture-and-tech-stack.md](./01-system-architecture-and-tech-stack.md)** — **System Architecture & Tech Stack**: Ingress topology, component diagram, technology versions, monorepo directory tree, and role-based security boundaries.
- **[02-database-schema-and-data-models.md](./02-database-schema-and-data-models.md)** — **Database Schema & Data Models**: Relational ERD, 22-table data dictionary, PostgreSQL 16 reference DDL, PostGIS expression GIST spatial indexes, and spatial boundary queries.
- **[03-api-specifications-and-endpoints.md](./03-api-specifications-and-endpoints.md)** — **API Specifications & Endpoints**: Global JSON response envelopes, RESTful contracts, DTO schemas, and RBAC guards across all modules.
- **[04-realtime-events-and-websocket-protocol.md](./04-realtime-events-and-websocket-protocol.md)** — **Real-Time WebSockets & Event Protocol**: Socket.IO gateway, JWT handshake, room subscription matrix, event payload catalog, and reconnection reconciliation.
- **[05-order-state-machine-and-dispatch-engine.md](./05-order-state-machine-and-dispatch-engine.md)** — **Order State Machine & Dispatch Engine**: Dual-flow FSM (`RIDER_FIRST` vs `VENDOR_FIRST`), transition matrix, Redis proximity radius queries, distributed mutex claim lock, and double-entry accounting formulas.
- **[06-frontend-and-mobile-architecture.md](./06-frontend-and-mobile-architecture.md)** — **Frontend & Mobile Architecture**: Feature-first Riverpod Flutter apps (Customer & Rider), native phone/maps handoffs, React 18 SPA route registries, Web Audio API oscillator chime synthesis, and Leaflet radar map.
- **[07-deployment-devops-and-environment-setup.md](./07-deployment-devops-and-environment-setup.md)** — **DevOps, Docker & Environment Setup**: Docker Compose multi-container stack, Nginx subpath reverse proxy routing, `.env.example` specifications, PostGIS initialization, and 10-vendor seed strategy.

---

## 2. Technical Specifications Reference

- For the line-by-line granular technical capability index with automated test traceability across all 5 sub-projects, consult [`FEATURES.md`](../../FEATURES.md).
- For individual deep-dive implementation specifications, schemas, DDL, REST endpoints, and WebSockets, consult the numbered documents above (`TID-01` through `TID-07`).
- To route directly to the specific implementation document required for your task, consult [`context_docs/QUICK_REFERENCE.md`](../QUICK_REFERENCE.md).
