# DeliveryOS — Production Deployment (VPS + Docker Compose)

Target topology: single VPS running `deploy/docker-compose.prod.yml` (Postgres/PostGIS, Redis, backend API, 2 SPA portals, TLS nginx, certbot).

## 1. Required environment

Create a `.env` next to the compose files (see repo-root `.env.example` as the base) and set — all are **fail-fast**: the stack refuses to boot with any of them missing.

| Variable | Notes |
|---|---|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Strong, generated passwords (e.g. `openssl rand -hex 24`) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Minimum 32 characters each |
| `SMS_PROVIDER` | `ssl_wireless` (SMS Plus v3); `mock` is rejected in production. Needs `SMS_SSLW_API_TOKEN` + `SMS_SSLW_SID` |
| `DOMAIN` | TLS hostname, e.g. `api.deliveryos.example.com` |
| `ACME_EMAIL` | Let's Encrypt account email |
| `CORS_ORIGINS` | Defaults to `https://$DOMAIN`; add extra origins comma-separated |

## 2. First-boot TLS issuance (one-time)

Certificates must exist before nginx starts (the TLS server block loads them at boot):

```bash
cd deploy
# 1. Start everything except nginx/certbot
docker compose -f docker-compose.prod.yml up -d postgres redis backend admin_portal vendor_portal

# 2. Issue the first certificate (standalone, binds port 80 — stop host nginx first if any)
docker compose -f docker-compose.prod.yml run --rm -p 80:80 certbot certonly \
  --standalone -d "$DOMAIN" --email "$ACME_EMAIL" --agree-tos --no-eff-email

# 3. Start the edge + renewal loop
docker compose -f docker-compose.prod.yml up -d nginx certbot
```

Renewal runs automatically inside the `certbot` service every 12h via webroot; after each successful renewal, reload nginx once:

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 3. Migrations

The backend container runs `prisma migrate deploy` on every start (see `services/backend_api/Dockerfile` CMD). No manual migration step is needed on deploys; schema is never out of sync with the image.

## 4. Health & uptime

- In-container healthchecks: every service has one (`docker compose ps` shows status).
- External uptime monitoring: point any free pinger (UptimeRobot, Better Stack, etc.) at `https://$DOMAIN/api/v1/health` — it returns `503` when the database or Redis is degraded.

## 5. Logs

All services rotate their JSON logs (`json-file`, 10 MB × 3 files). The API emits structured JSON logs with an `x-request-id` correlation id on every request (also set as a response header).

## 6. Backups

`scripts/backup-db.sh` dumps + gzips the database, optionally uploads offsite, and prunes local copies after 7 days.

**Offsite upload** — set one of these (rclone is recommended for Cloudflare R2):

```bash
BACKUP_OFFSITE_TARGET=rclone:r2/deliveryos   # requires `rclone config` on the host
BACKUP_OFFSITE_TARGET=s3://deliveryos-backups/prod   # requires AWS CLI + credentials
```

**Scheduling** — install the provided systemd units (or an equivalent crontab):

```bash
sudo cp deploy/systemd/deliveryos-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now deliveryos-backup.timer
```

Cron equivalent: `15 3 * * * cd /opt/deliveryos && BACKUP_OFFSITE_TARGET=... ./scripts/backup-db.sh`

**Restore** — `scripts/restore-db.sh backups/<file>.sql.gz` (prompts for confirmation; the target database is replaced). Test a restore after the first real backup.

## 7. Scaling notes

The stack is single-replica by default. Horizontal readiness is built in (ADR-015): the Socket.IO gateway fans events through the Redis adapter, background sweeps take a distributed leader lock per tick, and the edge proxy holds no session state. To run a second backend replica: remove `container_name`/port bindings for `backend`, run `docker compose up -d --scale backend=2`, and keep Postgres/Redis at 1.
