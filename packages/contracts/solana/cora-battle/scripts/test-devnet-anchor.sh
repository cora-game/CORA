#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.devnet" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.devnet"
  set +a
fi

: "${ANCHOR_PROVIDER_URL:=https://api.devnet.solana.com}"
: "${ANCHOR_WALLET:=$HOME/.config/solana/id.json}"

echo "[devnet:anchor] RPC: ${ANCHOR_PROVIDER_URL}"
echo "[devnet:anchor] Wallet: ${ANCHOR_WALLET}"

ANCHOR_PROVIDER_URL="$ANCHOR_PROVIDER_URL" \
ANCHOR_WALLET="$ANCHOR_WALLET" \
ts-mocha -p ./tsconfig.json -t 180000 "tests/0*.test.ts" "tests/1*.test.ts" "tests/2*.test.ts" "$@"
