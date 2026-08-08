#!/usr/bin/env bash
set -euo pipefail

# redriverai.ca — bootstrap from cold clone to ready-to-deploy
# Run this after git clone to verify everything works before touching anything.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

echo "=== redriverai.ca Bootstrap ==="
echo ""

# --- Step 1: Basic file checks ---
echo "[1/5] Checking required files..."
FILES=("index.html" "style.css" "script.js" "_headers" "_redirects" "deploy.sh" "scripts/verify-site.py")
ALL_OK=true
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    pass "$f"
  else
    fail "MISSING: $f"
    ALL_OK=false
  fi
done
if [ "$ALL_OK" = false ]; then
  echo ""
  echo "ERROR: Required files missing. Is this a complete clone?"
  exit 1
fi
echo ""

# --- Step 2: Check wrangler ---
echo "[2/5] Checking Cloudflare wrangler..."
if command -v npx &>/dev/null; then
  WRANGLER_VERSION=$(npx wrangler --version 2>/dev/null || echo "unknown")
  pass "npx wrangler available ($WRANGLER_VERSION)"
else
  fail "npx not found — install Node.js first"
  exit 1
fi
echo ""

# --- Step 3: Check env vars ---
echo "[3/5] Checking environment variables..."
ENV_OK=true
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  warn "CLOUDFLARE_API_TOKEN not set (needed for deploy)"
  ENV_OK=false
else
  pass "CLOUDFLARE_API_TOKEN set"
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  warn "CLOUDFLARE_ACCOUNT_ID not set (afc1b6457a4a0060ae932c53e856b97b)"
  ENV_OK=false
else
  pass "CLOUDFLARE_ACCOUNT_ID set"
fi
if [ "$ENV_OK" = false ]; then
  echo ""
  echo "  ⚠   Deploy won't work until both env vars are set."
  echo "  Set them in your shell or add to ~/.bashrc:"
  echo "    export CLOUDFLARE_API_TOKEN=cfut_..."
  echo "    export CLOUDFLARE_ACCOUNT_ID=afc1b6457a4a0060ae932c53e856b97b"
fi
echo ""

# --- Step 4: Verify git backup ---
echo "[4/5] Checking git backup tags..."
if git tag | grep -q backup; then
  LATEST=$(git tag | grep backup | tail -1)
  pass "Backup tags exist (latest: $LATEST)"
else
  warn "No backup tags found — run: git tag backup-before-<change>-$(date +%Y-%m-%d)"
fi
echo ""

# --- Step 5: Run verification suite ---
echo "[5/5] Running verify-site.py..."
if python3 scripts/verify-site.py 2>&1; then
  pass "Verification suite passed"
else
  warn "Verification suite had failures (see above)"
  echo "  This might be OK if the site isn't deployed yet or you're offline."
  echo "  Re-run after deploy: python3 scripts/verify-site.py"
fi
echo ""

# --- Summary ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Bootstrap complete!"
echo ""
echo "To deploy:"
echo "  ./deploy.sh"
echo ""
echo "To verify post-deploy:"
echo "  python3 scripts/verify-site.py"
echo ""
echo "Live URLs:"
echo "  https://redriverai.ca"
echo "  https://www.redriverai.ca"
echo "  https://redriverai.pages.dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"