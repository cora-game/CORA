#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE_LOG="${ROOT_DIR}/.magicblock-base.log"
ER_LOG="${ROOT_DIR}/.magicblock-er.log"

BASE_PID=""
ER_PID=""

cleanup() {
  if [[ -n "${ER_PID}" ]] && kill -0 "${ER_PID}" 2>/dev/null; then
    kill "${ER_PID}" 2>/dev/null || true
    wait "${ER_PID}" 2>/dev/null || true
  fi
  if [[ -n "${BASE_PID}" ]] && kill -0 "${BASE_PID}" 2>/dev/null; then
    kill "${BASE_PID}" 2>/dev/null || true
    wait "${BASE_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_json_rpc() {
  local url="$1"
  local method="$2"
  local max_try="${3:-120}"
  local sleep_sec="${4:-1}"

  for ((i=1; i<=max_try; i++)); do
    if curl -s -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"${method}\",\"params\":[]}" | grep -q "\"result\""; then
      return 0
    fi
    sleep "$sleep_sec"
  done

  return 1
}

echo "[full-test] Building Anchor program..."
anchor build >/dev/null

echo "[full-test] Starting MagicBlock base validator..."
npm run magicblock:base >"$BASE_LOG" 2>&1 &
BASE_PID=$!
wait_for_json_rpc "http://127.0.0.1:8899" "getSlot" 180 1

echo "[full-test] Starting MagicBlock ER validator..."
npm run magicblock:er >"$ER_LOG" 2>&1 &
ER_PID=$!
wait_for_json_rpc "http://127.0.0.1:7799" "getIdentity" 180 1

echo "[full-test] Running full TypeScript suite with MagicBlock + timeout realtime fallback..."
ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS=1 \
ENABLE_REALTIME_TIMEOUT_TESTS=1 \
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 \
ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}" \
EPHEMERAL_PROVIDER_ENDPOINT="${EPHEMERAL_PROVIDER_ENDPOINT:-http://127.0.0.1:7799}" \
EPHEMERAL_WS_ENDPOINT="${EPHEMERAL_WS_ENDPOINT:-ws://127.0.0.1:7800}" \
npm run test:local

echo "[full-test] Done."
