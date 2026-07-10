# Deploy AI Commerce on the shared PickleFund VPS (135.181.30.143)

AI Commerce runs as an **isolated stack** (own pgvector DB + backend + frontend, no host ports)
**behind the existing `picklefund-nginx`** via a new `store.picklefund.uk` vhost. PickleFund is
untouched except: (1) one `include` line in its nginx.conf, (2) an extra network attachment on the
nginx container (reversible), (3) a new untracked vhost file in `nginx/conf.d/`.

> Subdomain used below: **store.picklefund.uk** (covered by the existing wildcard origin cert).

---

## Prerequisites (do first)

**A. Add 2 GB swap** — the box has 4 GB RAM and **0 swap**; the Next.js build can OOM without it.
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -m   # confirm Swap: 2048
```

**B. Cloudflare DNS** — add an A record (Proxied 🟠): `store` → `135.181.30.143`.
(Cert is wildcard `*.picklefund.uk`, so no new cert needed.)

**C. Get the code onto the VPS.** Push this repo to a (private) GitHub repo, then on the VPS:
```bash
mkdir -p /opt/ai-commerce && cd /opt/ai-commerce
git clone <YOUR_AI_COMMERCE_REPO_URL> .
```

---

## 1. Configure env
```bash
cd /opt/ai-commerce
cp deploy/.env.prod.example deploy/.env.prod
bash deploy/gen-secrets.sh          # copy generated lines into deploy/.env.prod
nano deploy/.env.prod
# Set at minimum:
#   DOMAIN=store.picklefund.uk
#   ACME_EMAIL=... (unused here — Cloudflare/nginx handle TLS — but keep valid)
#   POSTGRES_PASSWORD / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / INTEGRATION_ENC_KEY  (from gen-secrets)
```

## 2. Build & start the isolated stack (no host ports)
```bash
cd /opt/ai-commerce
docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml up -d --build
docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml ps
docker builder prune -f          # reclaim disk after build (box is at ~82%)
```
Backend auto-runs `prisma migrate deploy` on boot. Wait until `ai-commerce-api` is healthy:
```bash
docker inspect --format '{{.State.Health.Status}}' ai-commerce-api
```

## 3. Bridge the existing nginx into the commerce network (once)
```bash
docker network connect commerce-net picklefund-nginx
docker exec picklefund-nginx getent hosts ai-commerce-web ai-commerce-api   # should resolve both
```

## 4. Add the vhost to the existing nginx
```bash
# Ensure nginx.conf loads conf.d (idempotent — only adds if missing):
grep -q 'include /etc/nginx/conf.d/\*.conf;' /opt/picklefund/nginx/nginx.conf \
  || sed -i 's#include mime.types;#include mime.types;\n  include /etc/nginx/conf.d/*.conf;#' /opt/picklefund/nginx/nginx.conf

# Install the commerce vhost (untracked → survives PickleFund git pulls):
mkdir -p /opt/picklefund/nginx/conf.d
cp /opt/ai-commerce/deploy/nginx-commerce.conf /opt/picklefund/nginx/conf.d/commerce.conf

# Validate BEFORE reloading, then hot-reload (no downtime for PickleFund):
docker exec picklefund-nginx nginx -t
docker exec picklefund-nginx nginx -s reload
```
> ⚠️ Persist the include line: also add `include /etc/nginx/conf.d/*.conf;` to the PickleFund
> **repo** `nginx/nginx.conf` (via local → push → CI), else the next PickleFund deploy overwrites it.
> The `commerce.conf` file is untracked and will persist.

## 5. Seed the first admin (once) & rotate password
```bash
docker exec -it ai-commerce-api npx ts-node prisma/seed.ts
# Default: admin@commerce.local / Admin@12345 — change immediately in the app.
```

## 6. Verify
```bash
curl -s https://store.picklefund.uk/api/v1/health/ready   # {"status":"ready","checks":{"database":"up"}}
```
Open `https://store.picklefund.uk/` → login. Confirm PickleFund still works:
`https://app.picklefund.uk` and `https://api.picklefund.uk/health`.

---

## Updates
```bash
cd /opt/ai-commerce && git pull --ff-only
docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml up -d --build
docker builder prune -f
```

## Rollback / uninstall (fully reversible, PickleFund unaffected)
```bash
# Remove vhost + reload:
rm /opt/picklefund/nginx/conf.d/commerce.conf
docker exec picklefund-nginx nginx -t && docker exec picklefund-nginx nginx -s reload
# Detach nginx from commerce network:
docker network disconnect commerce-net picklefund-nginx
# Stop/remove the commerce stack:
cd /opt/ai-commerce && docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml down
# (add -v to also delete its DB volume aic_pgdata + uploads)
```

## Resource notes
- Disk was ~82% (6.5 GB free) — run `docker builder prune -f` after each build.
- 2 GB swap added in prereq A protects against OOM during builds.
- Commerce DB (`ai-commerce-db`) is separate from PickleFund's DB; not exposed to PickleFund's network.
- Backups: `bash deploy/backup.sh` uses container `commerce_postgres`; on this VPS the DB container is
  `ai-commerce-db` → run: `docker exec ai-commerce-db pg_dump -U <user> -d <db> | gzip > backup.sql.gz`.
