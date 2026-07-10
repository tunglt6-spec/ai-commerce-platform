# AI Commerce Platform — VPS Deployment Runbook

Production stack = **PostgreSQL/pgvector + NestJS backend + Next.js frontend + Caddy** (automatic HTTPS), all via Docker Compose. Backend applies DB migrations on boot (`prisma migrate deploy`, non-destructive).

---

## 0. Prerequisites
- A VPS (Ubuntu 22.04+ recommended), 2 vCPU / 4 GB RAM minimum.
- A domain name you control.
- Ports **80** and **443** open to the internet (for Caddy + Let's Encrypt).
- SSH access with a sudo-capable user.

## 1. DNS
Point your domain at the VPS:
```
A    commerce.example.com   ->  <VPS_PUBLIC_IP>
```
(Wait for propagation; Caddy needs this to issue the TLS certificate.)

## 2. Install Docker on the VPS
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # then log out/in so docker runs without sudo
docker --version && docker compose version
```

## 3. Get the code
```bash
git clone <YOUR_REPO_URL> ai-commerce
cd ai-commerce
```

## 4. Configure production env & secrets
```bash
cp deploy/.env.prod.example deploy/.env.prod
bash deploy/gen-secrets.sh        # copy the generated lines into deploy/.env.prod
nano deploy/.env.prod             # set DOMAIN, ACME_EMAIL; paste generated secrets
```
Required: `DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATION_ENC_KEY`.
Optional: `AI_GATEWAY_BASE_URL` + `AI_GATEWAY_API_KEY` (leave empty → AI agents run in graceful-fallback mode).

> `NEXT_PUBLIC_API_BASE_URL` is baked into the frontend image at build time from `DOMAIN` (→ `https://<DOMAIN>/api/v1`). If you change the domain, rebuild the frontend image.

## 5. First deploy
```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml up -d --build
```
- Postgres starts, becomes healthy.
- Backend boots → runs `prisma migrate deploy` → serves `/api/v1`.
- Caddy obtains a TLS cert for `DOMAIN` and starts routing.

Watch progress:
```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml ps
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml logs -f backend caddy
```

## 6. Seed the first admin (once)
```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml exec backend npx ts-node prisma/seed.ts
```
Then **change the admin password** by registering a new admin and disabling the seed account, or update the seed env before running.
Default (dev) seed: `admin@commerce.local` / `Admin@12345` — do NOT keep this in production.

## 7. Verify
```bash
curl -s https://<DOMAIN>/api/v1/health           # {"status":"ok",...}
curl -s https://<DOMAIN>/api/v1/health/ready     # {"status":"ready","checks":{"database":"up"}}
```
Open `https://<DOMAIN>/` → login screen. Log in, check dashboard loads real data.

## 8. Updates
```bash
git pull --ff-only
bash deploy/backup.sh
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml up -d --build
```
Or trigger the **Deploy (VPS)** GitHub Action (configure `SSH_HOST/SSH_USER/SSH_KEY/DEPLOY_PATH` repo secrets first).

## 9. Backup & restore
```bash
bash deploy/backup.sh                                  # -> backups/backup_<ts>.sql.gz (keeps last 30)
bash deploy/restore.sh backups/backup_<ts>.sql.gz      # confirm by typing the DB name
```
Schedule daily backups with cron:
```
0 3 * * * cd /path/to/ai-commerce && bash deploy/backup.sh >> backups/cron.log 2>&1
```

## 10. Rollback
```bash
git checkout <previous_commit_or_tag>
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml up -d --build
# If a migration must be reverted, restore the pre-deploy backup (step 9).
```
Migrations are additive/non-destructive; app rollback + (if needed) DB restore is the recovery path.

## 11. Operations
| Action | Command |
|--------|---------|
| Status | `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml ps` |
| Logs | `... logs -f backend` |
| Restart a service | `... restart backend` |
| Stop all | `... down` (keeps volumes/data) |
| Migration status | `... exec backend npx prisma migrate status` |

## 12. Security checklist (production)
- [ ] Strong unique secrets set (never the dev defaults).
- [ ] `INTEGRATION_ENC_KEY` set (32-byte) — integration credentials are AES-256-GCM encrypted at rest.
- [ ] Seed/dev admin password rotated.
- [ ] Firewall: expose only 80/443 (and SSH); Postgres is internal-only (not published).
- [ ] Daily DB backups scheduled and periodically test-restored.
- [ ] HTTPS working (Caddy) — HSTS header enabled.
- [ ] Set `AI_GATEWAY_*` only if using an LLM provider; keys are never sent to the client.

## Notes / known residuals
- Uploaded media is stored on a Docker volume (`uploads`). For multi-node or durability, switch `UPLOAD_DIR` to an S3/R2-backed mount or add an S3 adapter.
- Integrations perform real HTTP verify + signed webhooks; per-marketplace API mapping (Shopee/TikTok/… specific endpoints) is added per provider as credentials become available.
