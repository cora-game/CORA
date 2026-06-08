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
: "${EPHEMERAL_PROVIDER_ENDPOINT:=https://devnet-router.magicblock.app}"
: "${EPHEMERAL_WS_ENDPOINT:=wss://devnet-router.magicblock.app}"
: "${ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS:=1}"

echo "[devnet:magicrouter] Base RPC: ${ANCHOR_PROVIDER_URL}"
echo "[devnet:magicrouter] Router RPC: ${EPHEMERAL_PROVIDER_ENDPOINT}"
echo "[devnet:magicrouter] Router WS: ${EPHEMERAL_WS_ENDPOINT}"

ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS="$ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS" \
ANCHOR_PROVIDER_URL="$ANCHOR_PROVIDER_URL" \
ANCHOR_WALLET="$ANCHOR_WALLET" \
EPHEMERAL_PROVIDER_ENDPOINT="$EPHEMERAL_PROVIDER_ENDPOINT" \
EPHEMERAL_WS_ENDPOINT="$EPHEMERAL_WS_ENDPOINT" \
ts-mocha -p ./tsconfig.json -t 240000 "tests/3*-magicblock-*.test.ts" "$@"
