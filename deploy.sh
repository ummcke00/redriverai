#!/usr/bin/env bash
set -euo pipefail

# redriverai.ca — build and deploy to Cloudflare Pages
# Deploys the current directory as a direct-upload Pages project.
# Requires: wrangler, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== redriverai.ca Deploy ==="
echo ""

# --- Check prerequisites ---
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found — install Node.js first"
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN not set"
  echo "  Token needs Cloudflare Pages edit permission"
  exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "ERROR: CLOUDFLARE_ACCOUNT_ID not set"
  echo "  Account ID: afc1b6457a4a0060ae932c53e856b97b"
  exit 1
fi

# --- Pre-flight checks ---
echo "[1/3] Pre-flight checks..."
if git diff --stat --quiet; then
  echo "  ✓ Working tree clean"
else
  echo "  ⚠️  Uncommitted changes — these will be included in the deploy:"
  git diff --stat
  echo ""
  read -p "  Deploy anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborted. Commit or stash changes first."
    exit 1
  fi
fi

# --- Deploy ---
echo "[2/3] Deploying to Cloudflare Pages..."
npx wrangler pages deploy . \
  --project-name=redriverai \
  --commit-dirty=true

echo ""
echo "[3/3] Done!"
echo ""
echo "Live at:"
echo "  https://redriverai.ca"
echo "  https://www.redriverai.ca"
echo "  https://redriverai.pages.dev"
echo ""
echo "Verify: open https://redriverai.ca and check it looks right"