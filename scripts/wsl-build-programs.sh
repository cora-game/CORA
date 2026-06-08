#!/usr/bin/env bash
# Copy both Anchor programs to WSL-native fs and build .so with cargo build-sbf.
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
SRC="/mnt/c/Users/Asrock/Documents/GitHub/CORA/packages/contracts/solana"
DST="$HOME/cora-build"

echo "solana: $(solana --version)"
echo "rustc:  $(rustc --version)"
echo "sbf:    $(cargo-build-sbf --version | head -1)"

rm -rf "$DST"
mkdir -p "$DST"
for prog in cora-escrow cora-battle; do
  echo "=== copying $prog ==="
  mkdir -p "$DST/$prog"
  # copy everything except node_modules / target
  (cd "$SRC/$prog" && find . -type d \( -name node_modules -o -name target \) -prune -o -type f -print \
     | while read -r f; do mkdir -p "$DST/$prog/$(dirname "$f")"; cp "$SRC/$prog/$f" "$DST/$prog/$f"; done)
done

build_one() {
  local prog="$1"
  echo "================ BUILD $prog ================"
  cd "$DST/$prog"
  cargo build-sbf 2>&1 | tail -40
  echo "--- artifacts ($prog) ---"
  ls -la target/deploy/ 2>&1 || echo "no target/deploy"
}

build_one cora-escrow
build_one cora-battle
echo "ALL_BUILDS_DONE"
