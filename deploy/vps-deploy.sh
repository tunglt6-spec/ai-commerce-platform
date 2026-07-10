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

echo "==> [2/6] Build & start stack (no host ports)"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build
docker builder prune -f >/dev/null 2>&1 || true

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

echo "==> [5/6] Install vhost + validate + reload nginx (safe: test before reload)"
# Ensure the main nginx.conf loads conf.d (idempotent).
if ! grep -q 'include /etc/nginx/conf.d/\*.conf;' "$PICKLEFUND_NGINX_DIR/nginx.conf"; then
  sed -i 's#include mime.types;#include mime.types;\n  include /etc/nginx/conf.d/*.conf;#' "$PICKLEFUND_NGINX_DIR/nginx.conf"
  echo "    added include conf.d/*.conf to nginx.conf"
fi
mkdir -p "$PICKLEFUND_NGINX_DIR/conf.d"
cp "$REPO_DIR/deploy/nginx-commerce.conf" "$PICKLEFUND_NGINX_DIR/conf.d/commerce.conf"
if docker exec "$NGINX_CONTAINER" nginx -t; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
  echo "    nginx reloaded"
else
  echo "ERROR: nginx config test failed — NOT reloading (PickleFund unaffected)."
  exit 1
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
