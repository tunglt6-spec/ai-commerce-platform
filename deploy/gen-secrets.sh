#!/usr/bin/env bash
# Generate strong production secrets. Prints ready-to-paste .env.prod lines.
# Usage: bash deploy/gen-secrets.sh
set -euo pipefail

gen_hex() { openssl rand -hex 32; }         # 64 hex chars
gen_b64() { openssl rand -base64 32; }       # 32 bytes base64
gen_pw()  { openssl rand -base64 24 | tr -d '/+=' | cut -c1-32; }

echo "# --- Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) ---"
echo "POSTGRES_PASSWORD=$(gen_pw)"
echo "JWT_ACCESS_SECRET=$(gen_hex)"
echo "JWT_REFRESH_SECRET=$(gen_hex)"
echo "INTEGRATION_ENC_KEY=$(gen_b64)"
echo "# Copy the lines above into deploy/.env.prod (replacing the __CHANGE_ME__ values)."
