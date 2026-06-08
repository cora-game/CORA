#!/usr/bin/env bash
# Poll deploy-wallet balance until it reaches the deploy threshold.
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
W=$HOME/cora-deploy/keys/deploy-wallet.json
U=https://api.devnet.solana.com
THRESH=6.5
for i in $(seq 1 120); do
  solana airdrop 2 "$W" --url "$U" >/dev/null 2>&1 || true
  bal=$(solana balance "$W" --url "$U" 2>/dev/null | grep -oE '^[0-9.]+' || echo 0)
  ok=$(awk -v b="$bal" 'BEGIN{print (b+0>=ENVIRON["THRESH"]+0)?1:0}' THRESH="$THRESH" 2>/dev/null)
  ok=$(awk -v b="$bal" -v t="$THRESH" 'BEGIN{print (b+0>=t+0)?1:0}')
  echo "poll $i: balance=$bal"
  if [ "$ok" = "1" ]; then echo "FUNDED:$bal"; exit 0; fi
  sleep 15
done
echo "TIMEOUT_LAST_BALANCE:$bal"
exit 1
