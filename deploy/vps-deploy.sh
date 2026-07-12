#!/usr/bin/env bash
# Idempotent full deploy of AI Commerce on the shared PickleFund VPS.
# Single source of truth for both manual runs and CI (GitHub Actions).
#
# Usage (on the VPS, from the repo root):
#   bash deploy/vps-deploy.sh
#
# Requires: deploy/.env.prod present (DOMAIN + secrets); the existing
# picklefund-nginx container running. Safe to run repeatedly.
set -euo pipefail

# --- config (override via env if needed) ---
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/deploy/.env.prod}"
COMPOSE_FILE="$REPO_DIR/deploy/compose.vps.yml"
NGINX_CONTAINER="${NGINX_CONTAINER:-picklefund-nginx}"
PICKLEFUND_NGINX_DIR="${PICKLEFUND_NGINX_DIR:-/opt/picklefund/nginx}"
COMMERCE_NET="commerce-net"

cd "$REPO_DIR"

echo "==> [1/6] Preflight"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found. cp deploy/.env.prod.example deploy/.env.prod and fill it."; exit 1; }
# shellcheck disable=SC1090
DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
DOMAIN="${DOMAIN:-store.picklefund.uk}"
echo "    domain=$DOMAIN  compose=$COMPOSE_FILE"

echo "==> [2/6] Pull prebuilt images from GHCR & start stack (no compile on VPS)"
# Images are built + pushed by CI (GitHub runners). The VPS only PULLS them, so
# there is no TypeScript/Next compile here — eliminates the small-VPS OOM/timeout.
# IMAGE_TAG (the commit SHA) is exported by the deploy step; falls back to :latest.
# We do NOT `down` first: current containers keep serving until new images are up.
echo "    IMAGE_TAG=${IMAGE_TAG:-latest}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull ai-commerce-api ai-commerce-web
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker image prune -f >/dev/null 2>&1 || true

echo "==> [3/6] Wait for backend to be healthy (migrations run on boot)"
for i in $(seq 1 40); do
  status="$(docker inspect --format '{{.State.Health.Status}}' ai-commerce-api 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
echo "    ai-commerce-api: ${status:-unknown}"
[ "${status:-}" = "healthy" ] || { echo "ERROR: backend not healthy"; docker logs ai-commerce-api --tail=40; exit 1; }

echo "==> [4/6] Bridge existing nginx into $COMMERCE_NET (idempotent)"
if ! docker network inspect "$COMMERCE_NET" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -qw "$NGINX_CONTAINER"; then
  docker network connect "$COMMERCE_NET" "$NGINX_CONTAINER"
  echo "    connected $NGINX_CONTAINER -> $COMMERCE_NET"
else
  echo "    already connected"
fi

echo "==> [5/6] Install vhost into nginx + activate"
# Ensure the HOST nginx.conf includes conf.d. On this VPS picklefund-nginx mounts
# nginx.conf as a single read-only file and does NOT mount conf.d, so:
#   - the vhost must be copied INTO the container (docker cp), and
#   - an include change only takes effect after the container (re)starts, because a
#     single-file bind-mount pins the inode (sed -i creates a new inode).
if ! grep -q 'include /etc/nginx/conf.d/\*.conf;' "$PICKLEFUND_NGINX_DIR/nginx.conf"; then
  sed -i 's#include mime.types;#include mime.types;\n  include /etc/nginx/conf.d/*.conf;#' "$PICKLEFUND_NGINX_DIR/nginx.conf"
  echo "    added include conf.d/*.conf to host nginx.conf"
fi
# If commerce.conf is bind-mounted into picklefund-nginx (the durable hardening in
# PickleFund's docker-compose.override.yml), `docker cp` fails with "device or
# resource busy" — and is unnecessary, since `git reset` already updated the host
# file the mount points at. So the copy is best-effort (covers the non-mounted case).
docker cp "$REPO_DIR/deploy/nginx-commerce.conf" "$NGINX_CONTAINER:/etc/nginx/conf.d/commerce.conf" 2>/dev/null \
  || echo "    commerce.conf is bind-mounted (host file updated via git) — skipping docker cp"
docker exec "$NGINX_CONTAINER" rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

if docker exec "$NGINX_CONTAINER" grep -q 'include /etc/nginx/conf.d/\*.conf;' /etc/nginx/nginx.conf; then
  # Running config already loads conf.d -> validate + hot reload (no downtime).
  if docker exec "$NGINX_CONTAINER" nginx -t; then
    docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "    nginx reloaded"
  else
    echo "ERROR: nginx -t failed — NOT reloading (PickleFund unaffected)."
    exit 1
  fi
else
  # Stale bind-mount inode: running nginx.conf lacks the include -> restart to re-bind.
  echo "    running nginx.conf lacks include (stale inode) -> restarting nginx"
  docker restart "$NGINX_CONTAINER"
  sleep 4
fi

if docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null | grep -q "server_name store"; then
  echo "    store vhost loaded ✓"
else
  echo "    WARNING: store vhost not detected in running config"
fi

echo "==> [6/6] Verify"
# Internal check via nginx -> backend (works even before DNS propagates).
if docker exec "$NGINX_CONTAINER" wget -qO- "http://ai-commerce-api:3001/api/v1/health" >/dev/null 2>&1; then
  echo "    internal backend health: OK"
fi
# External check (needs DNS for $DOMAIN pointing here).
if curl -fsk "https://$DOMAIN/api/v1/health/ready" >/dev/null 2>&1; then
  echo "    https://$DOMAIN/api/v1/health/ready: OK"
else
  echo "    NOTE: external HTTPS check skipped/failed — ensure Cloudflare A record '$DOMAIN' -> this server (Proxied)."
fi

echo "==> DONE. AI Commerce deployed. App: https://$DOMAIN/"
