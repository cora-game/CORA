<div align="center">

<p><i>⚠️ CORA is still on Devnet. Fund your wallet with Devnet SOL from a faucet before trying the app.</i></p>

<img src="docs/assets/header.png" alt="CORA" width="560">

<p>
  <a href="https://orynth.dev/projects/cora" target="_blank" rel="noopener">
    <img src="https://orynth.dev/api/badge/cora?theme=dark&style=minimal" alt="Featured on Orynth" width="152" height="48" />
  </a>
</p>

<h3 align="center">Wager your mind. Settle on-chain.</h3>

<p align="center">
  <a href="#tech-stack">
    <img alt="Solana" src="https://img.shields.io/badge/Solana-Escrow%20%2B%20Settlement-14F195?style=for-the-badge&logo=solana&logoColor=000000">
  </a>
  <a href="#tech-stack">
    <img alt="RPCFast" src="https://img.shields.io/badge/RPCFast-Solana%20RPC%20Lane-0B1220?style=for-the-badge">
  </a>
  <a href="#tech-stack">
    <img alt="GoldRush" src="https://img.shields.io/badge/GoldRush-Blockchain%20Data-FFB300?style=for-the-badge">
  </a>
  <a href="#architecture">
    <img alt="MagicBlock" src="https://img.shields.io/badge/MagicBlock-ER%20Battle%20State-111111?style=for-the-badge">
  </a>
  <a href="#tech-stack">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-Web%20App-000000?style=for-the-badge&logo=next.js&logoColor=white">
  </a>
  <a href="#tech-stack">
    <img alt="Bun" src="https://img.shields.io/badge/Bun-Realtime%20Backend-f9f1e1?style=for-the-badge&logo=bun&logoColor=000000">
  </a>
</p>

</div>

## Signal

CORA is a web3 aptitude-battle project built on Solana.

Players connect a wallet, lock a wager, enter a real-time head-to-head battle, answer timed aptitude questions, and settle the result on-chain. Public queue play and private Blink challenges both feed into the same core battle loop, while MagicBlock can be enabled to mirror live battle state through delegated execution.

This repository is the active monorepo for the current CORA implementation.

## Why CORA

Most test-prep products are solitary, repetitive, and forgettable.

| Traditional Prep | CORA |
|---|---|
| solo drills | real-time PvP aptitude battles |
| low-consequence repetition | stake-backed focus and urgency |
| closed study sessions | Solana-native shareable challenges |
| local app-only logic | programmable, verifiable battle-state flows |

The result is a product that feels closer to a web3 arena than a traditional education app.

## Core Experience

### Public Queue

```text
wallet connect -> join queue -> FIFO match -> deposit escrow -> battle -> settle/refund
```

### Blink Challenge

```text
create challenge -> fund open challenge -> share Blink -> rival accepts -> battle -> settle/reclaim
```

### Battle Layer

```text
WebSocket room -> timed questions -> scientist abilities -> best-of-3 rounds -> result dispatch
```

## Architecture

| Layer | Role | Lives In |
|---|---|---|
| Money Layer | wager custody, open challenge funding, match activation, settlement verification, refund/reclaim flows | `packages/solana-program` |
| Battle Layer | real-time battle sessions, delegated state, round effects, timeout resolution, terminal outcomes | `packages/battle-anchor-032` |
| App Layer | landing, lobby, queue, challenge UX, WebSockets, actions, Blink transaction building, match orchestration | `apps/web`, `apps/api` |

When MagicBlock is enabled, CORA can create battle sessions, commit inline manifests, delegate live battle state, apply round effects, and resolve terminal outcomes through delegated execution.

## Tech Stack

| Surface | Stack |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Solana Wallet Adapter, TanStack Query |
| Backend | Bun, Hono, WebSockets, TypeScript |
| On-Chain / Web3 | Solana, Anchor, SPL Token, Solana Actions / Blinks, RPCFast, MagicBlock Ephemeral Rollups |
| Data / Services | Supabase, GoldRush / Covalent |

## Repo Map

```text
Cora/
|-- apps/
|   |-- api/                  # backend, matchmaking, actions, room runtime
|   `-- web/                  # frontend app
|-- packages/
|   |-- battle-anchor-032/    # MagicBlock-compatible battle program
|   |-- game-logic/           # battle engine and anti-cheat heuristics
|   |-- shared-types/         # shared contracts and escrow constants
|   |-- solana-client/        # generated IDLs and TS client artifacts
|   |-- solana-program/       # Solana escrow program
|   `-- ui/                   # placeholder shared UI package
|-- data/
|   |-- fixtures/
|   |-- questions/
|   `-- tokens/
|-- docs/
|   `-- MASTER.md             # high-level project source of truth
`-- scripts/
```

## Local Development

```bash
npm install
```

| Step | Action |
|---|---|
| 1 | Install dependencies from the repo root with `npm install` |
| 2 | Configure `apps/api/.env` and `apps/web/.env.local` with Solana / RPCFast, Supabase, and optional MagicBlock settings |
| 3 | Start the backend with `cd apps/api` then `bun run dev` |
| 4 | Start the frontend in a second terminal with `cd apps/web` then `npm run dev` |
| 5 | Open `http://localhost:3000` for the web app and `http://localhost:8080` for the backend |

## Product Reference

For the full project map, architecture, and implementation reference, see [docs/MASTER.md](docs/MASTER.md).

## Closing

CORA is designed to feel like a web3 arena product first and a study product second:

| Instead Of | CORA Uses |
|---|---|
| accounts | wallets |
| links | challenges |
| points | escrow |
| local-only simulation | delegated battle state |

If you are here to feel the product, start the web app and enter the arena.
