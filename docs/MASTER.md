# CORA - Master Reference

**Project Name:** CORA
**One-Line Pitch:** Real-time Solana wagering for aptitude battles, with public queue play, Blink challenge flow, and verifiable battle-state support through MagicBlock.

---

## Overview

CORA turns aptitude-test practice into a head-to-head battle game. Players connect a Solana wallet, lock a wager in escrow, answer timed questions, and settle the result on-chain.

The current repository is no longer just a concept MVP. It now contains:

- A Next.js web app for landing, lobby, queue, challenge acceptance, battle, and history views
- A Bun + Hono backend for matchmaking, WebSocket room state, Solana Actions, Blink transaction building, and settlement orchestration
- A Solana escrow program for wager custody and payout
- A separate MagicBlock-compatible battle program for delegated real-time battle state
- Shared TypeScript packages for game logic, escrow constants, and generated Solana client artifacts

---

## Product Model

At a high level, CORA supports two ways to start a match:

1. Public queue flow
Two players enter the matchmaking queue, get paired, deposit into a shared match escrow, then play.

2. Private Blink challenge flow
One player funds an open challenge on-chain, shares the Blink URL, and a rival accepts the challenge into the final match escrow.

Both flows converge into the same gameplay loop and final on-chain settlement model.

---

## Current Match Architecture

### Public Queue Flow

```text
1. Player joins public queue over WebSocket
2. FIFO queue pairs two players into a room
3. Room enters deposit phase
4. Players sign escrow transactions
   - player A initializes the match and deposits
   - player B deposits
5. Backend starts gameplay
6. Result is settled on-chain or refunded on timeout/error
```

### Blink Challenge Flow

```text
1. Creator opens a private challenge
2. Creator signs create_open_challenge
3. Challenge link is shared through Solana Actions / Blink UX
4. Challenger opens the challenge page or Blink
5. Challenger signs accept_challenge
6. Match room is hydrated and both players join the battle room
7. Gameplay runs
8. Result is settled on-chain or refunded/reclaimed by contract rules
```

### Gameplay Layer

Gameplay is real-time and mostly off-chain from the player's perspective:

- WebSocket rooms handle live state updates
- The backend deals questions, validates answers, and advances the game engine
- Battles are structured as best-of-3 rounds
- Players choose scientist characters with specialty modifiers
- Questions currently span `math`, `logical`, and `sequence`

When MagicBlock is configured, delegated battle-state updates are mirrored into the `cora-battle` program for verifiable real-time battle progression. When it is not configured, CORA falls back to engine-only battle execution.

### Settlement Layer

The escrow program remains the money layer:

- Wagers are locked in the escrow program
- The backend signs settlement authorization
- The contract verifies settlement instructions and releases funds
- The current fee model remains 2.5% to treasury and 97.5% to the winner
- Refund paths exist for timeout, draw, and failure cases

---

## On-Chain Programs

### 1. Escrow Program

Location:
- `packages/solana-program`

Responsibility:
- Hold player wagers
- Support public-match escrow flow
- Support Blink open-challenge flow
- Verify settlement authorization
- Handle refund and reclaim cases

Implemented instruction surface includes:

```rust
initialize_config(...)
update_config(...)
initialize_match(...)
deposit_wager(...)
create_open_challenge(...)
accept_challenge(...)
settle_match(...)
refund(...)
reclaim_challenge(...)
```

### 2. Battle Program

Location:
- `packages/battle-anchor-032`

Responsibility:
- Represent real-time battle session state
- Support delegated execution through MagicBlock / Ephemeral Rollups
- Track rounds, health, scores, manifests, and terminal outcomes

Implemented instruction surface includes:

```rust
create_session(...)
set_card_manifest(...)
activate_session(...)
apply_effect(...)
resolve_round_by_state(...)
timeout_player_for_round(...)
surrender_match(...)
finalize_match(...)
delegate_battle_session(...)
commit_battle_session(...)
undelegate_battle_session(...)
```

Legacy compatibility instructions still exist for older card-registration paths, but the current backend flow is centered on inline manifest setup plus delegated effect application.

---

## Backend Responsibilities

Location:
- `apps/api`

Current backend scope includes:

- Hono HTTP API
- Bun WebSocket server
- Public FIFO matchmaking
- Private Blink room orchestration
- Solana Actions endpoints under `/api/actions`
- Match room lifecycle and janitors
- Settlement signing and payout dispatch
- Optional MagicBlock orchestration for battle-state delegation
- Question loading from Supabase with local JSON fallback
- History and wallet playability endpoints

### Key Runtime Routes

- `/api/actions` for Solana Actions / Blink support
- `/api/history` for arena and wallet history endpoints
- `/api/match` for match-related HTTP APIs
- `/match/:roomId` for room WebSocket connection
- `/queue` for matchmaking WebSocket connection

### External Integrations

- **Supabase**: question selection and Blink/match persistence support
- **GoldRush / Covalent**: token pricing and wallet playability checks
- **Solana RPC**: escrow and settlement
- **MagicBlock Router / Ephemeral endpoints**: delegated battle-state execution when enabled

Note: the current wallet and arena history endpoints are still mocked, while pricing/playability and question-loading paths are partially live.

---

## Frontend Responsibilities

Location:
- `apps/web`

The web app currently includes:

- Landing page
- Wallet connection flow
- Lobby and queue flow
- Character selection
- Deposit and opponent-found phases
- Battle screen
- Result and rematch challenge UX
- Blink challenge acceptance page
- History page
- Dev room-state view

Important user-facing flows already present in the codebase:

- Public queue matchmaking
- Private Blink challenge creation and acceptance
- Challenge share card generation
- Result share / rematch Blink generation
- Wallet-based arena playability checks

---

## Game Logic and Data

### Game Logic

Location:
- `packages/game-logic`

Responsibilities:

- Core battle engine
- Question dealing
- Score and round progression
- Anti-cheat heuristics

The repo currently contains a TypeScript anti-cheat analyzer used by the runtime engine. This is not a notebook-based PoC anymore.

### Shared Types

Location:
- `packages/shared-types`

Responsibilities:

- Escrow constants and match-id derivation
- WebSocket payload contracts
- Question and character-related shared types

### Solana Client Artifacts

Location:
- `packages/solana-client`

Responsibilities:

- Generated IDL JSON
- Generated TypeScript client types for both on-chain programs

### Question Data

Location:
- `data/questions`

Current state:

- Local JSON question bank is present
- Backend can load questions from disk as fallback
- Current pool contains 105 questions
- Categories currently used by the system are `math`, `logical`, and `sequence`

### Token Data

Location:
- `apps/api/src/config/tokens.ts`
- `data/tokens`

Current configured symbols:

- `SOL`
- `BONK`
- `USDC`

The codebase is token-agnostic by design, but these are the currently wired symbols in runtime config.

---

## Current Repository Structure

```text
Cora/
|-- .github/
|   `-- workflows/
|-- apps/
|   |-- api/
|   `-- web/
|-- packages/
|   |-- battle-anchor-032/
|   |-- game-logic/
|   |-- shared-types/
|   |-- solana-client/
|   |-- solana-program/
|   `-- ui/
|-- data/
|   |-- fixtures/
|   |-- questions/
|   `-- tokens/
|-- docs/
|-- notebooks/
|-- scripts/
|-- logs/
|-- package.json
|-- package-lock.json
`-- bun.lock
```

### Structure Notes

- `apps/api` is the active backend service
- `apps/web` is the active frontend app
- `packages/solana-program` is the escrow contract root
- `packages/battle-anchor-032` is the separate Anchor root for the MagicBlock-compatible battle program
- `packages/solana-client` stores generated client artifacts
- `packages/ui` currently exists as a placeholder package, not a populated shared component system
- `notebooks/` currently exists but is effectively empty

---

## Ownership Model

This is the practical ownership split implied by the current repo:

- Frontend work primarily lives in `apps/web`
- Backend and networking work primarily lives in `apps/api`
- Core gameplay logic primarily lives in `packages/game-logic`
- Shared cross-app contracts primarily live in `packages/shared-types`
- Escrow/web3 work primarily lives in `packages/solana-program`
- MagicBlock battle-state work primarily lives in `packages/battle-anchor-032`
- Generated on-chain client artifacts live in `packages/solana-client`

---

## What Is Implemented vs Placeholder

### Implemented

- Public FIFO matchmaking
- Room WebSocket lifecycle
- On-chain escrow deposits and settlement
- Blink open-challenge flow
- Dedicated challenge acceptance route/page
- Character-based battle loop
- Optional MagicBlock-backed battle-state flow
- Shared escrow constants and match-id derivation
- Local question-bank fallback
- History UI and API surface

### Partial / In Progress

- Supabase-backed question selection and persistence
- GoldRush-backed wallet intelligence
- Fully live history data
- Production-grade observability and deployment hardening

### Placeholder / Minimal

- `packages/ui` shared package
- `notebooks/` research directory
- Some data folders such as `data/tokens` and `data/fixtures`

---

## Out of Scope or Not Yet Productized

These items are not the current source-of-truth MVP deliverables:

- Native mobile app
- Open generalized wagering protocol
- DAO / governance layer
- Dedicated standalone settlement-oracle app
- Fully productionized anti-cheat ML pipeline
- Rich notebook-based ML research artifacts in-repo

---

## Current Validation Target

The clearest end-to-end validation loop for the current codebase is:

> A player opens the web app, connects a wallet, enters either the public queue or a private Blink challenge, locks a wager through the escrow program, plays a real-time aptitude battle, and completes settlement on-chain with optional MagicBlock-backed battle-state verification.

---

## Source of Truth Guidance

This document is the high-level project reference.

For implementation truth, prefer:

- `apps/api/src/index.ts` for runtime backend surface
- `apps/api/src/services/BlinkTransactionBuilder.ts` for escrow transaction-building flows
- `apps/api/src/services/magicblock.ts` for delegated battle-state integration
- `packages/solana-program/programs/solana-program/src/lib.rs` for escrow program surface
- `packages/battle-anchor-032/programs/cora-battle/src/lib.rs` for battle program surface
- `apps/web/src/app` and `apps/web/src/components` for active frontend flows

