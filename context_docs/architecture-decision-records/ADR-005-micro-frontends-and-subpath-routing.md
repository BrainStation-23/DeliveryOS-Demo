# ADR-005: Micro-Frontend Separation & Nginx Subpath Proxying (`/` vs `/vendor/`)

## Status
**Accepted** (2026-09-21)

---

## Context & Problem Statement
The platform requires two distinct web applications:
1. **Super Admin Console**: Centralized platform governance (fleet radar, dispatch overrides, system settings, financial accounting).
2. **Vendor Kitchen Console (KDS)**: Store-level kitchen display system, stockout toggles, prep timers, and multi-outlet brand switching.

Bundling both into a single monolith creates security risks (admin bundle leakage to merchants), theme collisions (Enterprise Indigo vs Culinary Amber), bloated bundle sizes, and shared cookie/token collisions. We required two independent SPAs operating behind a unified edge ingress port (`8080`).

---

## Decision Drivers
- **Role & Codebase Isolation**: Kitchen workers must not download admin code or components.
- **Independent Design Systems**: Admin uses Indigo/Slate; Vendor KDS uses high-contrast Amber/Orange optimized for kitchen displays.
- **Single Public Port**: Ingress on `8080` routes both portals without exposing internal ports `3000` or `3001`.
- **Session Namespace Isolation**: Simultaneous logins to both portals on `localhost:8080` must not overwrite JWT tokens.

---

## Considered Options
1. **Monolithic Unified React SPA**: Single codebase with role-based routing. *(Rejected: Risk of code leakage and bundle bloat)*.
2. **Subdomain Routing (`admin.domain` vs `vendor.domain`)**: Subdomains for each portal. *(Rejected: High local dev friction; requires DNS/hosts modifications)*.
3. **Dedicated React SPAs with Nginx Subpath Proxying (Chosen)**: Root path `/` for Admin, subpath `/vendor/` for Vendor KDS.

---

## Decision Outcome
Chosen option: **Dedicated React SPAs with Nginx Subpath Proxying**.

| Portal | Source Directory | Vite Base | React Router Basename | Storage Namespaces |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | [`apps/admin_portal`](../../apps/admin_portal) | `/` | `/` | `deliveryos_admin_auth`<br/>`deliveryos_admin_token` |
| **Vendor KDS** | [`apps/vendor_portal`](../../apps/vendor_portal) | `/vendor/` | `/vendor` | `deliveryos_vendor_auth`<br/>`deliveryos_vendor_token` |

### Positive Consequences
- **Zero Asset 404s**: Vendor assets load cleanly under `/vendor/assets/...`.
- **Zero Session Collisions**: Independent storage namespaces prevent token overwrites across tabs.
- **Strict Role Boundaries**: Unauthorized role navigation is blocked at both the Nginx proxy and React Router guards.

### Negative Consequences & Mitigations
- *Trade-off*: Nginx must maintain distinct HTML5 history fallback rules (`try_files`) for subpaths.
- *Mitigation*: Automated ingress tests verify route rewrites.

---

## Technical Implementation Details
In [`deploy/nginx.local.conf`](../../deploy/nginx.local.conf):
```nginx
# Super Admin Portal (Root)
location / {
    proxy_pass http://admin_portal:8080;
    proxy_set_header Host $host;
}

# Vendor KDS Portal (Subpath)
location /vendor/ {
    proxy_pass http://vendor_portal:8080/vendor/;
    proxy_set_header Host $host;
}
```

In [`apps/vendor_portal/vite.config.ts`](../../apps/vendor_portal/vite.config.ts):
```typescript
export default defineConfig({
  base: '/vendor/',
  plugins: [react()],
});
```

---

## Compliance & Verification
- Scaffolding tests: Verified via [`test-scaffolding.ts`](../../apps/admin_portal/scripts/test-scaffolding.ts) in both portals.
- Ingress response checks: `curl -I http://localhost:8080/` and `curl -I http://localhost:8080/vendor/` return HTTP 200.
