# DeliveryOS Production Release & Deployment Runbook

This runbook defines the authoritative operational procedures for releasing DeliveryOS to staging and production environments.

---

## 1. Pre-Deployment Release Checklist

Before deploying any version to production, verify each gate:

- [ ] **Quality Gates Passed**: Root `npm run verify` exits 0 with 100% test integrity (329+ Jest tests, 204+ Vitest tests, 142+ Flutter tests).
- [ ] **Realtime Matrix Parity**: `npm run verify:realtime` reports 100% bidirectional parity between backend Socket.IO emitters and client listeners.
- [ ] **Database Backup**: Execute `./scripts/backup-db.sh` to generate a fresh, compressed database snapshot (`deliveryos_backup_<timestamp>.sql.gz`) with offsite sync.
- [ ] **Environment Configuration**: Validate that all production secrets are exported (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_BASE_URL` (live), `SMS_SSLW_API_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`).
- [ ] **Nginx Edge Invariants**: Confirm `deploy/nginx-templates/default.conf.template` uses dynamic Docker DNS resolution (`resolver 127.0.0.11 valid=10s ipv6=off;`) with variable proxy pass to prevent 502 Bad Gateway upon container recreation.

---

## 2. Database Migration & Schema Evolution

### Fresh Production System Launch (Initial Boot)
DeliveryOS launches as a clean, modern production system with zero legacy baggage or deprecated compatibility layers. To initialize the brand-new production environment:

```bash
# 1. Boot core datastores
docker compose -f deploy/docker-compose.prod.yml up -d postgres redis

# 2. Apply the clean baseline schema migration (0_init)
docker compose -f deploy/docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# 3. Seed canonical reference and operational dataset
docker compose -f deploy/docker-compose.prod.yml exec -T backend npm run prisma:seed

# 4. Verify system health
curl -s http://localhost:4000/api/v1/health | jq .
```

### Zero-Downtime Schema Evolution Policy
- **Additive Only**: When modifying schema post-launch, never drop columns or rename existing active fields during an active deployment. Add new columns as optional or with non-breaking defaults.
- **Foreign Key Immutability**: Financial ledgers (`commission_ledgers`, `rider_trip_ledgers`, `settlement_batches`) enforce `RESTRICT` on delete to guarantee immutable accounting trails (ADR-022).

### Migration Execution
```bash
# Apply pending Prisma migrations
docker compose -f deploy/docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# Verify migration status
docker compose -f deploy/docker-compose.prod.yml exec -T backend npx prisma migrate status
```

---

## 3. Zero-Downtime Rolling Service Deployment

Deploy updated application containers using Docker Compose rolling recreation:

```bash
# 1. Pull updated container images
docker compose -f deploy/docker-compose.prod.yml pull backend admin_portal vendor_portal

# 2. Recreate Backend API container
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --build backend

# 3. Wait for backend health check
curl --fail --retry 10 --retry-delay 2 http://localhost:4000/api/v1/health

# 4. Recreate Web Portals
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --build admin_portal vendor_portal

# 5. Reload Nginx configuration without dropping connections
docker compose -f deploy/docker-compose.prod.yml exec edge-proxy nginx -s reload
```

---

## 4. Post-Deployment Verification Drill

Run the standard post-deploy smoke checklist:

1. **System Health Check**:
   ```bash
   curl -s http://localhost:8080/api/v1/health | jq .
   # Expected output:
   # { "status": "healthy", "services": { "database": "up", "redis": "up" } }
   ```
2. **Web Portal Ingress**:
   - Super Admin: Visit `https://your-domain.com/` → verify login screen renders.
   - Vendor KDS: Visit `https://your-domain.com/vendor/` → verify KDS login screen renders.
3. **WebSocket Gateway**:
   - Connect client to `wss://your-domain.com/events` → verify successful Socket.IO handshake.
4. **Active Order FSM**:
   - Run business & financial integrity smoke script against staging:
     ```bash
     npm run test:business-integrity --prefix services/backend_api
     ```

---

## 5. Emergency Rollback Runbook

If a critical failure occurs during deployment (e.g. fatal migration crash or unrecoverable gateway error):

### Step 1: Revert Code & Containers Immediately
```bash
# Revert to previous release tag
git checkout <PREVIOUS_RELEASE_TAG>

# Redeploy previous stable container images
docker compose -f deploy/docker-compose.prod.yml up -d --build backend admin_portal vendor_portal
docker compose -f deploy/docker-compose.prod.yml exec edge-proxy nginx -s reload
```

### Step 2: Restore Database from Pre-Deployment Backup
If data corruption occurred:
```bash
# Decompress and restore database snapshot
gunzip -c backups/deliveryos_backup_<PRE_DEPLOY_TIMESTAMP>.sql.gz | \
  docker exec -i deliveryos_db psql -U postgres -d deliveryos
```

### Step 3: Flush Realtime Cache & Mutex Keys
```bash
# Clear active dispatch locks and ephemeral rider caches in Redis
docker exec -i deliveryos_redis redis-cli FLUSHDB
```

### Step 4: Verification
Confirm `/api/v1/health` reports status `healthy` and verify customer order placement.
