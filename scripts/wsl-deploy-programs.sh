#!/usr/bin/env bash
# Deploy both programs to devnet under the new program IDs.
set -uo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

U=https://api.devnet.solana.com
WALLET=$HOME/cora-deploy/keys/deploy-wallet.json
ESCROW_SO=$HOME/cora-build/cora-escrow/target/deploy/solana_program.so
ESCROW_ID=$HOME/cora-deploy/keys/escrow-program-id.json
BATTLE_SO=$HOME/cora-build/cora-battle/target/deploy/cora_battle.so
BATTLE_ID=$HOME/cora-deploy/keys/battle-program-id.json

echo "Fee payer / upgrade authority: $(solana-keygen pubkey $WALLET)"
echo "Balance: $(solana balance $WALLET --url $U)"

echo "================ DEPLOY cora-escrow ================"
echo "program id: $(solana-keygen pubkey $ESCROW_ID)"
solana program deploy "$ESCROW_SO" \
  --program-id "$ESCROW_ID" \
  --keypair "$WALLET" \
  --url "$U" \
  --with-compute-unit-price 1 \
  --max-sign-attempts 60
echo "escrow deploy exit: $?"

echo "================ DEPLOY cora-battle ================"
echo "program id: $(solana-keygen pubkey $BATTLE_ID)"
solana program deploy "$BATTLE_SO" \
  --program-id "$BATTLE_ID" \
  --keypair "$WALLET" \
  --url "$U" \
  --with-compute-unit-price 1 \
  --max-sign-attempts 60
echo "battle deploy exit: $?"

echo "================ VERIFY ================"
solana program show "$(solana-keygen pubkey $ESCROW_ID)" --url "$U" || true
echo "---"
solana program show "$(solana-keygen pubkey $BATTLE_ID)" --url "$U" || true
echo "Remaining balance: $(solana balance $WALLET --url $U)"
echo "DEPLOY_SCRIPT_DONE"
