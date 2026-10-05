# DeliveryOS Production Release & Deployment Runbook

This runbook defines the authoritative operational procedures for releasing DeliveryOS to staging and production environments.

---

## 1. Pre-Deployment Release Checklist

Before deploying any version to production, verify each gate:

- [ ] **Quality Gates Passed**: Root `npm run verify` exits 0 with 100% test integrity (329+ Jest tests, 204+ Vitest tests, 142+ Flutter tests).
- [ ] **Realtime Matrix Parity**: `npm run verify:realtime` reports 100% bidirectional parity between backend Socket.IO emitters and client listeners.
- [ ] **Database Backup**: Execute `./scripts/backup-db.sh` to generate a fresh, compressed database snapshot (`deliveryos_backup_<timestamp>.sql.gz`) with offsite sync.
- [ ] **Environment Configuration**: Validate that all production secrets are exported (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD`, `SSLCOMMERZ_IS_SANDBOX=false`, `SSLWIRELESS_API_TOKEN`, `FCM_CREDENTIALS_JSON`).
- [ ] **Nginx Edge Invariants**: Confirm `deploy/nginx-templates/default.conf.template` uses dynamic Docker DNS resolution (`resolver 127.0.0.11 valid=10s ipv6=off;`) with variable proxy pass to prevent 502 Bad Gateway upon container recreation.

---

## 2. Database Migration & Schema Evolution

### Zero-Downtime Migration Policy
- **Additive Only**: Never drop columns or rename existing active fields during an active deployment. Add new columns as optional or with non-breaking defaults.
- **Foreign Key Immutability**: Financial ledgers (`vendor_settlement_ledgers`, `rider_trip_ledgers`, `commission_ledgers`) use `RESTRICT` on delete to prevent cascading data loss.

### Migration Execution
```bash
# 1. Apply Prisma migrations without schema recreation
docker compose -f deploy/docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# 2. Verify migration status
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
