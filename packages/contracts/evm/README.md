# CoraEscrow (Base Sepolia)

Native-ETH wager escrow for CORA matches. Solidity port of the former Solana
`cora-escrow` Anchor program. Built with [Foundry](https://book.getfoundry.sh/).

- `src/CoraEscrow.sol` — the escrow contract (deposit / settle / refund / open-challenge).
- `test/CoraEscrow.t.sol` — forge tests (winner payout, anti-cheat, refund timeouts, challenge lifecycle, EIP-712 signature recovery).
- `script/Deploy.s.sol` — deployment script.

## Money flow

- Two players each deposit `wager` ETH into a match (`initializeMatch` is called
  server-side first; players then call `deposit(matchId)` with `value = wager`).
- Normal result: server signs an EIP-712 `Settlement(action=0, target=winner)` and
  submits `settleMatch` → winner gets 97.5% of the 2× pool, treasury gets 2.5%.
- Anti-cheat: `action=1, target=cheater` → honest player refunded, cheater stake → treasury.
- Timeout refunds + open-challenge create/accept/reclaim mirror the Solana program.

The server's secp256k1 EOA (`serverSigner`) replaces the Solana ed25519 keypair.
The on-chain ed25519-sysvar check is replaced by EIP-712 + `ecrecover`, binding
each signature to this chain id and contract (replay-safe). The ABI consumed by
the API and web app lives in `packages/shared-types/src/escrowAbi.ts` — keep it in
sync with this contract (or regenerate from `out/CoraEscrow.sol/CoraEscrow.json`).

## Prerequisites — install Foundry

Foundry is not yet installed in this repo. Install it once (the automated agent
could not run the installer — run this yourself):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge install foundry-rs/forge-std   # from this directory
```

## Build & test

```bash
cd packages/contracts/evm
forge build
forge test -vvv
```

## Deploy to Base Sepolia

Set the deploy env (or pass inline), then run the script:

```bash
export PRIVATE_KEY=0x...            # deployer (becomes admin), funded with Base Sepolia ETH
export TREASURY_ADDRESS=0x...       # fee receiver
export SERVER_SIGNER_ADDRESS=0x...  # must equal the API's SERVER_PRIVATE_KEY address
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org   # or a paid RPC
export ETHERSCAN_API_KEY=...        # optional, for --verify on Basescan

forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
```

Record the deployed address and wire it into:
- API: `ESCROW_CONTRACT_ADDRESS`, `SERVER_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL` (+ optional `BASE_SEPOLIA_WS_URL`).
- Web: `NEXT_PUBLIC_ESCROW_ADDRESS`, `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID=84532`, `NEXT_PUBLIC_WALLETCONNECT_ID`.

Fund both the deployer and the server signer with Base Sepolia ETH from a faucet
(e.g. https://www.alchemy.com/faucets/base-sepolia).
