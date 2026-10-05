# ADR-021: Nginx Edge Dynamic DNS Resolution & Reverse Proxy Invariants

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: Platform Infrastructure Board, SRE
- **Related**: [ADR-001](./ADR-001-modular-monorepo-and-ingress-topology.md) (ingress topology), [ADR-005](./ADR-005-micro-frontends-and-subpath-routing.md) (subpath proxying)

## Context

In containerized deployments using Docker Compose or Docker Swarm, Nginx historically cached the IP address of upstream hostnames (e.g., `backend:4000`, `admin_portal:3000`) resolved during server startup. When backend or web portal containers were restarted, recreated, or rolled during zero-downtime deployments, their container IPs changed, causing Nginx to emit `502 Bad Gateway` errors until Nginx itself was reloaded.

## Decision

1. **Embedded Docker DNS Resolver**:
   - In `deploy/nginx-templates/default.conf.template`, configure Docker's internal DNS resolver:
     ```nginx
     resolver 127.0.0.11 valid=10s ipv6=off;
     ```
2. **Variable-Based Proxy Passes**:
   - By setting proxy targets into runtime variables rather than static upstream blocks, Nginx re-resolves the IP address according to the resolver TTL (`valid=10s`):
     ```nginx
     set $backend_upstream http://backend:4000;
     proxy_pass $backend_upstream;
     ```
3. **Applied Across All Micro-Services**:
   - This dynamic proxy pattern applies uniformly to the REST API (`/api/v1/`), WebSocket gateway (`/events`), and the web portal frontends (`/` and `/vendor/`).

## Consequences

- Container recreations, rolling updates, and scaling operations no longer trigger persistent 502 Bad Gateway responses.
- Upstream container IP changes are picked up automatically within 10 seconds.
