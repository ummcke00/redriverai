#!/usr/bin/env bash
# Deploy the redriverai site to Cloudflare Pages.
set -euo pipefail

CRED="$HOME/.openclaw/workspace/credentials/credentials.env"
SITE="$HOME/redriverai-website"

TOK="$(grep '^CLOUDFLARE_API_TOKEN_PAGES=' "$CRED" | head -1 | cut -d= -f2-)"
TOK="${TOK%\"}"; TOK="${TOK#\"}"
TOK="${TOK%\'}"; TOK="${TOK#\'}"

echo "token length: ${#TOK}"

export CLOUDFLARE_API_TOKEN="$TOK"
export CLOUDFLARE_ACCOUNT_ID="afc1b6457a4a0060ae932c53e856b97b"

cd "$SITE"
npx wrangler pages deploy . --project-name=redriverai --commit-dirty=true 2>&1 | tail -10
