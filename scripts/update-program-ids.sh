#!/usr/bin/env bash
# Swap old devnet program IDs -> newly generated IDs across source, IDLs, and config.
set -euo pipefail

ROOT="/mnt/c/Users/Asrock/Documents/GitHub/CORA"

OLD_ESCROW="9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W"
NEW_ESCROW="8h5gHVN29FzmeJSbQXtrvEptxUmDKFag9BQCy3Ky1ZxN"
OLD_BATTLE="3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8"
NEW_BATTLE="Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic"

FILES=(
  "packages/contracts/solana/cora-escrow/programs/solana-program/src/lib.rs"
  "packages/contracts/solana/cora-escrow/Anchor.toml"
  "packages/contracts/solana/cora-battle/programs/cora-battle/src/lib.rs"
  "packages/contracts/solana/cora-battle/Anchor.toml"
  "packages/contracts/solana/cora-battle/tests/helpers/battleTestUtils.ts"
  "packages/contracts/solana/cora-battle/package.json"
  "packages/solana-client/src/solana_program.json"
  "packages/solana-client/src/solana_program.ts"
  "packages/solana-client/src/cora_battle.json"
  "packages/solana-client/src/cora_battle.ts"
  "apps/api/src/config/solana.ts"
  "apps/api/src/services/magicblock.ts"
)

for f in "${FILES[@]}"; do
  p="$ROOT/$f"
  if [[ ! -f "$p" ]]; then echo "MISSING: $f"; continue; fi
  be=$(grep -c "$OLD_ESCROW" "$p" || true)
  bb=$(grep -c "$OLD_BATTLE" "$p" || true)
  sed -i "s/$OLD_ESCROW/$NEW_ESCROW/g; s/$OLD_BATTLE/$NEW_BATTLE/g" "$p"
  echo "updated $f  (escrow x$be, battle x$bb)"
done

echo "--- verify no old IDs remain in updated files ---"
for f in "${FILES[@]}"; do
  p="$ROOT/$f"
  [[ -f "$p" ]] || continue
  if grep -qE "$OLD_ESCROW|$OLD_BATTLE" "$p"; then echo "STILL HAS OLD ID: $f"; fi
done
echo "done"
