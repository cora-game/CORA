# GAME Role - Development Log

## 1. Question Data & Schema

**Implementation:**

- Added TypeScript interfaces and validation logic for `Question` and `Option` structures in `packages/shared-types/src/question.ts`.
- Defined a strict structure requiring exactly 4 options per question.

**The Reasoning:**

- A unified structure avoids runtime errors when parsing AI-generated questions or reading from `questions.json`.
- Sharing the types via the `shared-types` package allows the backend, frontend, and testing scripts to stay perfectly synchronized.

**Tech Debt:**

- Currently using manual runtime validation. If schema complexity grows, we should migrate to Zod to automatically derive interfaces and handle validation.

---

## 2. Core Game Engine Architecture

**Implementation:**
Built the core Game Engine as a pure, I/O-free TypeScript class in `packages/game-logic/`. It relies on event-emission (`timerSync`, `damageEvent`, etc.) rather than websockets directly, allowing the `RoomManager` to handle network broadcasting independently.

**Engine Rules & Mechanics:**

- **Match Duration:** 5 minutes (300,000 ms).
- **Extra Point Phase:** The final 1 minute applies a 2x multiplier to all damage and healing.
- **Base Damage/Heal:** 10 HP per correct answer. Heal caps at 100 HP.
- **Hand Size:** 5 cards, auto-refilled instantly from a shared queue when played.
- **Card Distribution:** 60% attack, 40% heal.
- **Win Conditions:** Instant win if opponent hits 0 HP. If time runs out, the player with the highest HP wins (tie-breaker by score).

**Tech Debt:**

- Rate limit constants (e.g., 500ms cooldowns) and card type distributions are currently hardcoded. They should be extracted into configurable parameters for easier balancing.

---

## 3. Question Dealer & Competitive Fairness

**Implementation:**
The `QuestionDealer` and `GameEngine` have been heavily refactored to ensure a completely fair trivia competition:

- **Balanced Selection:** Questions are drawn using a round-robin category selection algorithm (Sequence → Logical → Math) rather than purely random shuffling.
- **No Duplicates:** The dealer returns `null` when the question pool is exhausted, strictly guaranteeing no duplicate questions in a single match.
- **Identical Shared Queue:** Upon match initialization, the `GameEngine` pre-generates a single shared queue of up to 100 cards. Both players start with an identical hand (cards 0-4). As they play, they draw the next card in the shared sequence based on their personal `queueIndex`.

**The Reasoning:**

- A completely random shuffle could occasionally deal hands heavily skewed toward a single category, punishing players based on luck.
- An identical shared queue guarantees that the match is a true race of knowledge. Both players face the exact same questions in the exact same order.
- Pre-generating the shared queue prevents desync issues and mismatched `correctOptionId` validations.

**Tech Debt:**

- The engine expects the `questions.json` pool to have enough questions to sustain a 5-minute match without running out (generating up to 100 cards). If players exhaust the 100-card queue, they will stop receiving cards. We must either expand the pool significantly or gracefully declare a draw if the pool runs dry.

---

## 4. Testing & Stabilization

**Implementation:**

- Implemented `packages/game-logic/mock-match.ts`, a 2-player terminal simulation to validate the engine's lifecycle headless.
- Created `packages/game-logic/visual-test.ts` to visually verify that both players receive identical hands and identical card replenishments from the shared queue.
- Expanded unit tests (`GameEngine.test.ts` and `QuestionDealer.test.ts`) using `bun:test` to cover win conditions, exhaustion limits, correct schema validation (4 options), and cooldowns.

**The Reasoning:**

- A pure, I/O-free engine makes deterministic testing possible and prevents hard-to-track race conditions.
- Terminal simulations allow rapid iteration on the game loop without needing to spin up the web frontend or websocket server.

---

## 5. Anti-Cheat System

**Implementation:**

- Implemented `AntiCheatAnalyzer`, a stateless-per-action behavioral analysis engine that tracks player interaction patterns (answer speed, accuracy rate, consistency, input cadence, etc.).
- Integrated it directly into the `GameEngine`, recording every `playCard` action without slowing down the game loop.
- Emits an `AntiCheatVerdict` (`trusted`, `suspicious`, `rejected`) upon game completion.
- Updated the `RoomManager` to consume these verdicts, actively halting on-chain settlement for `rejected` matches and broadcasting a `matchInvalidated` event.
- Created `docs/ML-DATA-COLLECTION.md` detailing how raw `PlayerMatchStats` are collected for future Machine Learning model training.

**The Reasoning:**

- Real money wagers require a trustless environment. A 10-second timer isn't enough to stop specialized answer bots (OCR + LLM) or macro-assisted clicks.
- The system must remain entirely server-side. Any client-side anti-cheat can be reverse-engineered and bypassed.
- By emitting warnings on `suspicious` play but only blocking on `rejected`, we minimize false positives affecting legitimate players.

**Tech Debt:**

- We are currently using static, educated-guess thresholds for penalties (e.g., < 1500ms average response time is penalized). We need to review the logged data over the first few thousand matches to fine-tune these thresholds, eventually transitioning to an ML-based approach.

---

## 6. Bugfixes — Matchmaking & Round Timer (2026-05-01)

**The Bugs:**

1. **Matchmaking order-dependent failure:** When using port forwarding (public URL), the first player to enter the queue would silently drop out before the second player joined. Matches only worked if the friend entered first.
2. **Round timer reset without round change:** When the 5-minute timer expired, the clock reset to 5:00 but the round number, health, and game state never updated on the frontend.

**The Change:**

_Files touched:_ `packages/game-logic/src/GameEngine.ts`, `apps/api/src/managers/RoomManager.ts`

**Bug 1 (Matchmaking):**

- Root cause: `POST /match` used HTTP long-polling — the server held the request open until a match was found. Port forwarding proxies killed idle HTTP connections, firing the request's `AbortSignal` and removing the player from the queue before their opponent joined.
- Fix: Added three resilience layers to `queueMatch()`:
  1. **Room existence check:** If the player already has an active room (from a lost HTTP response), return it immediately.
  2. **Duplicate queue check:** If the player is already queued (from a dropped connection), chain the new request's resolve to the existing entry instead of adding a duplicate.
  3. **Server-side TTL:** Queue entries auto-expire after 5 minutes to prevent memory leaks from ghost entries.
- Also cleaned up pre-existing dead imports (`MatchFoundData`, `CharacterState`, `Card`).

**Bug 2 (Round Timer):**

- Root cause: `resetRound()` reset the timer, health, and round number internally but never emitted a `stateUpdate` event. The `roundOver` event handler in `RoomManager` broadcast the game state _before_ `resetRound()` was called, so the frontend received stale data.
- Fix:
  1. Reordered: `resetRound()` is now called _before_ emitting `roundOver`, so the broadcasted state reflects the new round.
  2. `resetRound()` now emits `stateUpdate` at the end, ensuring the frontend receives the updated round number, reset health, and reset timer.

**Tech Debt:**

- The `POST /match` endpoint still uses HTTP long-polling, which is inherently fragile with reverse proxies. A more robust approach would be to return `{ status: 'queued' }` immediately and notify via WebSocket when a match is found. This is deferred for now since the resilience layers mitigate the issue.

---

## 7. Bugfix — Deposit Freeze & Engine Crash (2026-05-01)

**The Bug:**
After both players deposited, the room would freeze and then get cancelled by a shot clock. Server logs showed `TypeError: undefined is not an object (evaluating 'player.address')` in `GameEngine.toPlayerState`.

**Root Cause (3 interlinked issues):**

1. **`allDeposited` checked `room.playerMeta.values()`** — which only contains players who connected via WebSocket (`joinRoom` populates it). If only 1 player connected, the check trivially passed with a single `true` entry.
2. **`initializeEngine` used `room.clients.keys()`** as the player address list — with only 1 client, the `GameEngine` was created with a 1-element array despite expecting a tuple of 2. The opponent lookup then returned `undefined`, crashing `toPlayerState`.
3. **No guard for 2-player connectivity** — the game could start before both WebSocket connections were established.

**The Fix:**
_Files touched:_ `apps/api/src/managers/RoomManager.ts`

1. `allDeposited` now explicitly checks `room.playerA` and `room.playerB` deposits, not an arbitrary iteration of `playerMeta`.
2. `initializeEngine` now uses `[room.playerA, room.playerB]` (the authoritative role assignments from matchmaking), not `room.clients.keys()`.
3. Added a `room.clients.size < 2` guard before starting the engine.
4. Added a catch-up check in `joinRoom`: when the second player finally connects and both have already deposited, the game starts immediately.

**Tech Debt:**

- None introduced. This was a correctness fix that made the deposit flow resilient to connection timing.

---

## 8. Settlement — Graceful Skip Without RPC (2026-05-01)

**The Bug:**
After a match ended, the server spammed noisy retry errors and full stack traces trying to submit an on-chain settlement transaction to `http://127.0.0.1:8899` — a local Solana validator that wasn't running.

**Root Cause:**
No `.env` file existed (only `.env.example`), so `SOLANA_RPC_URL` was undefined and the fallback `http://127.0.0.1:8899` was unreachable. The `withRetry` helper tried 3 times before printing a massive error, even though the game itself was unaffected.

**The Fix:**
_Files touched:_ `apps/api/src/utils/settlement.ts`

- Added `hasExplicitRpc` flag that checks if `SOLANA_RPC_URL` is set in the environment.
- `submitSettlementTransaction` now returns `'SKIPPED_NO_RPC'` immediately when no RPC is configured, with a clean one-line log.
- The server startup log now indicates when the default (unconfigured) RPC is being used.

**Tech Debt:**

- When ready for mainnet/devnet testing, create `apps/api/.env` with `SOLANA_RPC_URL=https://api.devnet.solana.com` to enable real on-chain settlement.

---

## 9. Character Specialty Stats — Category Damage Multiplier (2026-05-04)

**The Change:**

_Files touched:_

- `packages/shared-types/src/characterStats.ts` (NEW)
- `packages/game-logic/src/GameEngine.ts`
- `apps/api/src/managers/RoomManager.ts`
- `apps/web/src/components/lobby/LobbyScreen.tsx`
- `apps/web/src/app/dev/room-states/page.tsx`

Each character now has a **specialty question category**. When a player answers a question from their character's specialty category correctly, their damage/heal is multiplied by **1.5x**:

| Character       | ID         | Specialty  | Effect                     |
| --------------- | ---------- | ---------- | -------------------------- |
| Alan Turing     | `turing`   | `sequence` | 1.5x on sequence questions |
| Marie Curie     | `curie`    | `logical`  | 1.5x on logical questions  |
| Albert Einstein | `einstein` | `math`     | 1.5x on math questions     |

The specialty multiplier **stacks multiplicatively** with the existing extra-point phase multiplier (2x), yielding up to **3x** in the final minute on specialty questions.

**Implementation Details:**

1. Created `characterStats.ts` in `shared-types` as a single source of truth for character definitions (`CHARACTER_DEFS`) and a `getSpecialtyMultiplier()` helper function.
2. In `GameEngine.playCard()`, the multiplier computation was split into `phaseMultiplier` (1x normal / 2x extra) and `specialtyMultiplier` (1x non-specialty / 1.5x specialty), then combined: `multiplier = phaseMultiplier * specialtyMultiplier`.
3. Restored default `characterId` fallbacks in backend to `'einstein'` per user request, while leaving frontend character UI as Newton.
4. Updated frontend character stats to visually reflect each character's specialty category (e.g. Turing's primary stat is "Sequence", Curie's is "Logical", Newton's is "Math").

**The Reasoning:**

- Character differentiation adds strategic depth. Players must weigh their character choice against the mixed-category question pool.
- A shared definition in `shared-types` prevents frontend/backend character data from drifting out of sync.
- Multiplicative stacking with extra-point phase rewards high-skill play during clutch moments.

**Tech Debt:**

- The frontend `CharacterCard` shows generic stat bars but does not explicitly label the 1.5x specialty bonus. A tooltip or badge ("1.5x Sequence Damage") would improve discoverability.
- Character definitions exist in two places: `characterStats.ts` (backend-authoritative) and `SCIENTISTS[]` in `LobbyScreen.tsx` (frontend display). These should eventually be unified or auto-derived.

---

## 10. RPC Migration — RPCFast Integration (2026-05-04)

**The Change:**

_Files touched:_

- `apps/api/.env.example`
- `apps/api/src/utils/settlement.ts`
- `apps/api/src/utils/eventListener.ts`
- `apps/api/src/index.ts`
- `apps/web/src/components/Providers.tsx`
- `apps/web/.env`

Migrated the Solana RPC layer from the public `api.devnet.solana.com` to support **RPCFast** (`rpcfast.com`), a high-performance RPC provider and Frontier Hackathon sponsor.

**What changed:**

1. **Backend (`settlement.ts`):** The singleton `Connection` now accepts an optional `SOLANA_WS_URL` for explicit WebSocket configuration (RPCFast may provide separate HTTP/WS endpoints).
2. **Backend (`eventListener.ts`):** `startEventListener()` now takes an optional `wsUrl` parameter instead of blindly converting `https→wss`. Falls back to the old derivation when no explicit WS URL is set.
3. **Backend (`index.ts`):** Passes `SOLANA_WS_URL` env var to the event listener.
4. **Frontend (`Providers.tsx`):** `ConnectionProvider` now reads `NEXT_PUBLIC_SOLANA_RPC_URL` from the environment, falling back to `clusterApiUrl('devnet')` when unset.
5. **Env files:** Updated `.env.example` and `apps/web/.env` with RPCFast-specific documentation and placeholders.

**The Reasoning:**

- Public Solana RPC endpoints are rate-limited and unreliable for production use (especially for `sendAndConfirmTransaction` and `onLogs` subscriptions).
- RPCFast provides <20ms latency, dedicated infrastructure, and free hackathon credits — a direct upgrade for CORA's on-chain settlement path.
- Adding `SOLANA_WS_URL` as a separate env var is necessary because some RPC providers (including RPCFast) serve WebSocket traffic on different endpoints than their HTTP API.

**Tech Debt:**

- The `actions.ts` route still creates a one-off `new Connection()` per POST request (line 199). This should be refactored to use the shared singleton from `settlement.ts`.
- No automated health check to validate the RPC endpoint on startup. A `getSlot()` probe would catch misconfigured URLs early.

---

## 11. Game Status — Explicit `settling` Phase (2026-05-05)

**The Change:**

_Files touched:_

- `apps/api/src/managers/RoomManager.ts`
- `packages/shared-types/src/escrow.ts`

Added an explicit `settling` status to the game lifecycle, making the canonical flow:

```
waiting → depositing → playing → settling → finished
```

Previously, `GameStatus` in `websocket.ts` already defined `settling` as a valid status, but `RoomManager` never set it — jumping directly from `playing` to `finished`. The settlement logic (anti-cheat evaluation, on-chain tx dispatch) happened invisibly during the `finished` state.

**What changed:**

1. **`RoomManager.ts` (gameOver handler):** Room now transitions to `settling` before anti-cheat evaluation and settlement dispatch. A `gameStateUpdate` is broadcast so FE sees `status: 'settling'`. After settlement is dispatched, status moves to `finished` with a second broadcast.
2. **`RoomManager.ts` (forfeitMatch):** Same pattern — `settling` → settlement work → `finished`.
3. **`RoomManager.ts` (broadcastGameState):** Engine state is now returned during `settling` phase (previously only `playing` and `finished`).
4. **`RoomManager.ts` (debug viz):** Added ⚖️ icon for `settling` rooms in the FIFO visualization.
5. **`escrow.ts` (GAME_TO_CHAIN_STATUS):** Added `settling: 'Active'` mapping — on-chain the match is still Active until the settlement tx confirms.

**The Reasoning:**

- FE requested clarity on whether `settling` is a real status. It is now canonical and always emitted.
- Debugging is easier when the server log shows the settlement window explicitly instead of collapsing it into `finished`.
- FE can show a settlement spinner/animation during this brief window, improving UX.

**Tech Debt:**

- The `settling` → `finished` transition is currently synchronous (settlement tx is dispatched async via `.then()`). If we need FE to know when settlement _actually confirms_ on-chain, we'd need to await the tx and broadcast a `settlementConfirmed` event. For now the async fire-and-forget is fine.

---

## 12. Bugfix � FIFO Matchmaking Race Conditions & Memory Leaks (2026-05-05)

**The Bugs:**
The FIFO matchmaking queue and room lifecycle had 7 interlinked bugs causing solo rooms, locked-out players, and server crashes, especially over high-latency tunnel connections:

1. `initializeEngine` mistakenly used `room.clients.keys()` instead of `room.playerA/playerB`, causing solo rooms and server crashes if one websocket connected before the other.
2. Finished rooms were never deleted from memory, causing unbounded iteration and memory leaks.
3. No try/catch around the `gameOver` settlement logic � if on-chain settlement failed, rooms were stuck in `settling` forever.
4. `ws.send()` calls could throw if the socket closed unexpectedly, crashing entire event handlers.
5. `queueMatch` reconnect guard returned zombie room IDs for rooms stuck in `depositing` or `settling`, permanently locking players out of matchmaking.
6. GameEngine timers were never explicitly stopped when rooms were cancelled, causing leaked intervals.
7. `cancelRoom` re-queue captured a stale WebSocket reference from the deleted room, preventing re-queued players from receiving the `matchFound` event.

**The Fix:**
_Files touched:_ `apps/api/src/managers/RoomManager.ts`, `packages/game-logic/src/GameEngine.ts`

1. **Engine Role Fix:** Restored `[room.playerA, room.playerB]` initialization in `GameEngine`, guaranteeing correct 2-player setup regardless of WebSocket connection order.
2. **Room Cleanup:** Created a `destroyRoom(roomId)` helper that safely clears timeouts, opened cards, stops the engine, and deletes the room.
3. **Delayed Deletion:** Scheduled `destroyRoom` to run 15 seconds after `gameOver`, allowing clients time to receive final events.
4. **Try/Catch Settlement:** Wrapped the `gameOver` handler in a `try/catch/finally` block to guarantee transition to `finished` even if anti-cheat or settlement fails.
5. **Safe Send:** Introduced `safeSend(ws, data)` wrapper to swallow `ws.send` errors if the connection silently drops.
6. **Staleness Guard:** Added logic to `queueMatch` reconnect: if a room is stuck in `depositing` with 0 active shot-clocks, it auto-destroys the zombie room and lets the player re-queue.
7. **Closure Fix:** Captured the WS reference directly before re-queueing in `cancelRoom` rather than referencing the deleted client map.
8. **TypeScript Fix:** Removed extra parameters (`tokenMint`, etc.) from `GameEngine.getStateForPlayer` return type using `Omit<GameState, ...>`.

**The Reasoning:**

- Matchmaking over networks (especially tunnels) requires aggressive defensive programming against dropped connections.
- The server must never retain state indefinitely; every room must have a guaranteed path to deletion (`destroyRoom`).
- Try/catch blocks around asynchronous third-party calls (like settlement or anti-cheat) prevent local state from locking up.

**Tech Debt:**

- Room state management is heavily reliant on timeouts. A state-machine approach (like XState) would formally prevent invalid transitions and zombie states.

---

## 13. Match Lifecycle Upgrade - Cancel, Surrender, Presence Recovery (2026-05-08)

**The Change:**

_Files touched:_

- `apps/api/src/index.ts`
- `apps/api/src/managers/RoomManager.ts`
- `apps/api/src/managers/room/Blockchain.ts`
- `apps/api/src/managers/room/Engine.ts`
- `apps/api/src/managers/room/Lifecycle.ts`
- `apps/api/src/managers/room/Network.ts`
- `apps/api/src/managers/room/Queue.ts`
- `apps/api/src/managers/room/types.ts`
- `apps/api/src/utils/settlement.ts`
- `apps/api/test/RoomManager.test.ts`
- `apps/web/src/components/lobby/LobbyScreen.tsx`
- `apps/web/src/components/lobby/OpponentFound.tsx`
- `apps/web/src/components/play/BattleScreen.tsx`
- `apps/web/src/hooks/useMatchSocket.ts`
- `apps/web/src/lib/matchmaking/queueMatch.ts`
- `packages/game-logic/src/GameEngine.ts`
- `packages/game-logic/src/types.ts`
- `packages/game-logic/test/GameEngine.test.ts`
- `packages/shared-types/src/websocket.ts`

Added explicit **match cancellation** and **surrender** flows across the full stack, then reworked disconnect handling so funded and active rooms stay recoverable instead of auto-forfeiting immediately.

**What changed:**

1. **Room lifecycle actions:** Added `cancelMatch` and `surrender` as first-class client intents instead of overloading disconnect behavior.
2. **Cancellation reasons:** Deposit-stage rooms can now end with explicit reasons:
   - player manually cancelled
   - deposit timeout expired
   - a player disconnected before the room was safely ready to start
3. **Presence-aware reconnects:** Once both players are funded, disconnect no longer triggers an automatic 10-second loss. The room remains open, the socket is nulled, `lastSeenAt` is tracked, and the server broadcasts presence changes until the player reconnects or surrenders.
4. **Surrender path:** A funded player can now concede during `depositing` or `playing`, and the room settles with `reason: 'surrender'` plus `surrenderedAddress`.
5. **Shared websocket contract:** Added `roomCancelled` and `presenceUpdate` events, expanded `PlayerState` with `isConnected`, `lastSeenAt`, and `correctAnswers`, and expanded `MatchResult` to support `winnerAddress: null`, `draw`, and richer final stats.
6. **Game engine tie resolution:** The engine now tracks `correctAnswers`, resolves round timeout by HP then correct answers, resolves final match outcome by rounds won then HP then correct answers, and emits a true `draw` if everything is still equal.
7. **Lobby recovery UX:** FE now stores an `active-room` snapshot, restores active rooms after refresh/reopen, and redirects players back into deposit or play flow when the backend confirms they are already in a live room.
8. **Battle UI updates:** Added a visible `Surrender` action and cleanup of persisted lobby/room recovery state once the match is complete or the player exits cleanly.

**The Reasoning:**

- Auto-forfeiting on disconnect was too harsh for real network conditions. Refreshes, browser restarts, and unstable tunnels should not instantly decide a wagered match.
- Cancellation and surrender represent different phases of intent. Cancelling is a pre-match lifecycle action; surrender is an in-match competitive outcome. Splitting them keeps room logic explicit and easier to reason about.
- Presence is part of game correctness now, not just UI polish. The server must know whether both sockets are actually alive before starting play or deciding whether a room should remain recoverable.
- A deterministic draw path is safer than arbitrarily choosing a winner in perfect ties. Since we already track rounds, HP, and answer accuracy, the engine can now explain why a match ended the way it did.
- FE persistence plus server-side active room lookup makes matchmaking and reconnect flow more resilient while the queue system still relies on HTTP request/response timing.

**Tech Debt:**

- Active-room recovery is currently split between `localStorage` snapshots and in-memory backend room lookup. It works, but the source of truth is still distributed across layers.
- Presence and cancellation logic are growing into a real state machine, but are still implemented as imperative lifecycle branches and timers. A formal statechart would reduce the chance of future edge-case regressions.
- Draw handling needs an end-to-end audit with the blockchain settlement path to guarantee refund behavior is fully deterministic and matches on-chain assumptions.
- The lobby recovery code is compensating for the current HTTP matchmaking design. A websocket-native queue/ready flow would simplify this significantly and remove some of the persistence glue.

---

## 14. Card Distribution Rebalance - Heal 1 per 5 Cards (2026-05-08)

**The Change:**

_Files touched:_

- `packages/game-logic/src/QuestionDealer.ts`
- `packages/game-logic/test/QuestionDealer.test.ts`

Reworked card-type assignment so `heal` no longer uses loose probability. The dealer now guarantees **exactly 1 heal card in every batch of 5 dealt cards**, while randomizing the heal slot inside each batch. That keeps the sequence less predictable without letting heal cards bunch up too often.

**The Reasoning:**

- The previous random distribution could create streaks that felt unfair, including too many heals appearing close together.
- The new batch-based rule matches the intended balancing target more directly: roughly 20% heal rate, with spacing controlled at the queue level.
- Because the match uses one shared pre-generated queue for both players, enforcing the rule in `QuestionDealer` keeps both fairness and determinism intact.

**Tech Debt:**

- The 5-card batch size is still hardcoded. If balancing keeps changing, this should become a configurable gameplay parameter instead of living inside `QuestionDealer`.

---

## 15. Queue Hardening - Deposit Cancel Recovery & Phantom Prompt Guard (2026-05-08)

**The Change:**

_Files touched:_

- `apps/api/src/index.ts`
- `apps/api/src/managers/room/Queue.ts`
- `apps/api/test/RoomManager.test.ts`
- `apps/web/src/components/lobby/LobbyScreen.tsx`
- `apps/web/src/components/lobby/OpponentFound.tsx`
- `apps/web/src/lib/matchmaking/queueMatch.ts`
- `apps/web/src/lib/solana/signDepositIntent.ts`

Hardened the public queue and deposit flow so cancelled deposit rooms stop trapping players, queue desync is auto-healed from the frontend, and slow Phantom approval now surfaces a clear stale-transaction warning.

**What changed:**

1. **Backend queue reclamation:** `Queue.queueMatch()` now reclaims abandoned `depositing` rooms before honoring a fresh queue request from the same wallet, cancelling and destroying the old room first.
2. **Zombie room cleanup:** `findActiveRoomForAddress()` now ignores and destroys deposit rooms that have no live sockets, no active deposit timers, and no deposits, preventing dead rooms from blocking matchmaking recovery.
3. **Queue presence endpoint:** Added `GET /match/presence/:address` so the frontend can distinguish between:
   - still queued
   - already inside a room
   - no longer present in queue state
4. **Lobby self-heal:** While on the waiting screen, the frontend now polls queue presence every 4 seconds. If the backend says the player is neither queued nor already matched, the lobby automatically restarts the matchmaking request instead of leaving the user in a fake "searching" state.
5. **Deposit UX hardening:** On the deposit screen, if Phantom approval stays open too long, the UI now warns the player that the transaction may expire and tells them to close the stale prompt and retry for a fresh transaction.
6. **Wallet error clarity:** RPC/blockhash-expiry style errors are now mapped to a clearer retry message rather than a generic Solana confirmation failure.
7. **Regression test coverage:** Added a RoomManager test covering the abandoned-deposit-room requeue case so the intended recovery path is documented in code, even though the current test environment still needs API-key isolation cleanup.

**The Reasoning:**

- The worst queue bug was not the manual cancel itself; it was stale room state surviving just long enough to make the next queue attempt fail. Reclaiming and destroying abandoned deposit rooms closes that gap.
- Since `/match` still relies on long-polling, the frontend needs a server-visible truth source for "am I really still queued?" Polling lightweight queue presence is much safer than trusting the local waiting screen blindly.
- Phantom popups that sit open too long often produce expired blockhash behavior. We cannot forcibly close the wallet, but we can detect the pattern, explain it immediately, and guide the player toward a fresh signing attempt.

**Tech Debt:**

- The public queue is still HTTP long-polling based. The new presence endpoint mitigates desync, but a websocket-native queue would remove this whole class of issues more cleanly.
- The RoomManager test suite currently imports services that expect external Goldrush credentials, which blocks clean local execution for pure room-lifecycle tests. Those dependencies should be isolated or mocked at the boundary.

---

## 16. Winner Tie-Break Update - Round, Score, Remaining Health (2026-05-08)

**The Change:**

_Files touched:_

- `packages/game-logic/src/GameEngine.ts`
- `packages/game-logic/test/GameEngine.test.ts`

Updated final match winner resolution so a finished room is now decided in this order:

1. `roundsWon`
2. `score`
3. `health` remaining

This removes `correctAnswers` from the final match tie-break path.

**What changed:**

1. **Final match comparator:** `determineMatchOutcome()` now compares `roundsWon` first, then `score`, then `health`.
2. **Removed old final fallback:** `correctAnswers` is no longer used to decide the final winner once the room finishes.
3. **Targeted regression coverage:** Updated engine tests to explicitly verify:
   - a player can win on higher `score` even when `health` is tied
   - `health` is only used after both `roundsWon` and `score` are tied

**The Reasoning:**

- The previous final winner order did not match the intended game rule requested for room completion.
- `score` is the better second-level match signal after round wins because it reflects total successful value generated across the match, not just the last surviving HP snapshot.
- Keeping `health` as the last fallback preserves a deterministic outcome without arbitrarily defaulting to player A.

**Test:**

- Verified with `bun test packages/game-logic/test/GameEngine.test.ts`
- Result: `20 pass`, `0 fail`

**Tech Debt:**

- Round timeout logic still uses its own local comparison flow (`health`, then `correctAnswers`) for deciding the winner of an expiring round. That is separate from final room resolution, but we should document and review whether both policies are intentionally different long-term.

---

## 17. Live Streak Payload for FE - Separate Current Streak from Anti-Cheat (2026-05-08)

**The Change:**

_Files touched:_

- `packages/shared-types/src/websocket.ts`
- `packages/game-logic/src/types.ts`
- `packages/game-logic/src/GameEngine.ts`
- `apps/api/src/managers/room/Network.ts`
- `packages/game-logic/test/GameEngine.test.ts`

Added a dedicated live streak field, `currentCorrectStreak`, to the player state returned to the frontend. This gives FE the real UX-facing streak value without reusing the anti-cheat-only `longestCorrectStreak`.

**What changed:**

1. **Shared websocket contract:** Extended `PlayerState` with `currentCorrectStreak` so the value is part of the canonical backend-to-FE game state.
2. **Engine live tracking:** `GameEngine` now stores and updates `currentCorrectStreak` per player during live play.
3. **Correct reset behavior:** A correct answer increments the streak; a wrong answer resets it to `0`.
4. **Pre-game payload compatibility:** Waiting/depositing room states now also include `currentCorrectStreak: 0` so FE gets a stable shape before the match starts.
5. **Regression coverage:** Added a test confirming the streak increments across consecutive correct answers and resets after a wrong answer.

**The Reasoning:**

- FE needs the player's *current* streak for UX feedback, but anti-cheat needs the *longest* streak over the whole match for behavioral analysis. Those are different meanings and should not share one field.
- Returning the live streak directly from the backend avoids fragile client-side reconstruction from prior events.
- Keeping `longestCorrectStreak` internal to anti-cheat preserves the original detection signal while giving FE a clean, player-facing value.

**Test:**

- Verified with `bun test packages/game-logic/test/GameEngine.test.ts`
- Result: `21 pass`, `0 fail`

**Tech Debt:**

- `currentCorrectStreak` currently lives only in live `gameStateUpdate` payloads. If we later want post-match UX summaries ("best streak this round" or "final streak before loss"), we should decide whether that belongs in final match result payloads too.

---

## 18. Inline Manifest Architecture Integration — (2026-05-10)

**The Change:**

_Files touched:_

- `apps/api/src/services/magicblock.ts`
- `apps/api/src/managers/room/Blockchain.ts`
- `apps/api/src/managers/room/Engine.ts`
- `apps/api/src/managers/room/Lifecycle.ts`
- `apps/api/src/managers/room/types.ts`
- `apps/api/src/managers/room/Store.ts`
- `apps/api/src/managers/RoomManager.ts`

Migrated to the **Inline Manifest** ER architecture to solve severe performance bottlenecks in setup/settlement and enable instant surrenders.

**What changed:**

1. **5-Tx Setup:** Replaced loop-based `registerCard` logic with a 2-transaction pre-commitment of both players' card manifests. Setup dropped from ~99 transactions (~45s) down to **5 transactions (~15s)**.
2. **2-Tx Settlement:** Since individual cards no longer generate on-chain PDAs, settlement no longer requires loop-based `commit` / `undelegate` calls. Settlement dropped from ~98 transactions (~52s) to **2 transactions (~4s)**.
3. **Slot-Based Tracking:** Modified the play-flow from referencing arbitrary card IDs to referencing precise, sequential manifest slot indexes. Valid answers, wrong answers, and timeouts now all definitively consume on-chain slots to maintain source-of-truth syncing.
4. **Authoritative Surrender:** Enabled the previously-disabled surrender flow via a terminal `surrender_match` ER instruction, resolving the winner/loser instantly and on-chain.
5. **Optimistic UI:** The `Engine` now fires `damageEvent` and `playCardResult` payloads immediately upon client validation **before** waiting for the ER lane transaction round-trip, stripping the apparent latency from gameplay entirely.

**The Reasoning:**

- The 1-PDA-per-card architecture imposed astronomical setup/teardown bloat on the Solana base layer. Moving that state into two inline vectors embedded into the primary `BattleSession` account is an asymptotic speedup for the platform.
- Optimistic UI is standard for modern online games. Relying on chain confirmation latency for animation rendering hurts the 'feel' of high-speed trivia.

**Tech Debt:**

- The legacy logic (registered card PDA loops) is deprecated but remains theoretically supported by raw functions in `magicblock.ts` for backwards compatibility during migration cutoff. It should be completely pruned once version stability is locked.
- Currently waiting on client-side IDL synchronization for final verification since instructions must perfectly match the new program schema.

---

## 19. Bugfix — InvalidEffectValue (0x1779) Slot Synchronization (2026-05-10)

**The Bug:**
The `cora-battle` Solana program consistently threw a `0x1779 InvalidEffectValue` error during MagicBlock ER card plays. This usually surfaced when a player chose to play an Attack card (value 50) while the smart contract expected a Heal card limit (max 30) for that slot.

**Root Cause:**
The backend `applyErCardEffect` was tracking `erNextSlotA` and `erNextSlotB` as blind, sequential increments (`0, 1, 2...`). However, the player's Hand gives them 3 cards, allowing them to play cards out of order relative to the generated manifest queue. If the manifest had Heal on Slot 0 and Attack on Slot 1, and the player played the Attack card first, the backend incorrectly submitted Slot 0 to the contract, causing a metadata mismatch and triggering the strict validation limit in the Solana program.

**The Fix:**
_Files touched:_ `apps/api/src/managers/room/Blockchain.ts`, `apps/api/src/managers/room/Engine.ts`, `apps/api/src/managers/room/types.ts`, `apps/api/src/managers/room/Store.ts`

- **Removed blind increment state:** Deleted `erNextSlotA` and `erNextSlotB` from tracking entirely.
- **Dynamic index lookup:** Updated `applyErCardEffect` to dynamically find the exact underlying manifest index using `findIndex` on the unmutated `matchQueue`:
  `const slot = room.engine.getMatchQueue().findIndex(c => c.id === params.cardId);`
- **Invalidation sync:** Updated `consumeErSlotEmpty` to accept the actual `cardId` meant to be consumed for timeouts or wrong answers, keeping backend/on-chain states locked to the specific card instance.

**The Reasoning:**
- The on-chain manifest tracks usage via an independent bitmask (`cards_used_a & bit`). It was explicitly designed by the smart contract engineers to support out-of-order execution safely. Replacing the rigid backend integer with a dynamic index search correctly honors the bitmask design without adding local lag (`O(N)` on ~100 array items runs in < 0.01ms).

**Tech Debt:**
- None. Logic is fully stateless and aligns execution with the Solana contract's bitmask design.

---

## 20. Queue WebSocket Migration - Phantom Speedup & Room Sync Protection (2026-05-11)

**The Change:**

_Files touched:_

- `apps/api/src/index.ts`
- `apps/api/src/managers/RoomManager.ts`
- `apps/api/src/managers/room/Lifecycle.ts`
- `apps/api/src/managers/room/Network.ts`
- `apps/api/src/managers/room/Queue.ts`
- `apps/api/src/managers/room/Store.ts`
- `apps/api/src/routes/match.ts`
- `apps/api/src/routes/queueSocket.ts`
- `apps/api/src/services/BlinkTransactionBuilder.ts`
- `apps/api/test/RoomManager.test.ts`
- `apps/web/src/components/lobby/LobbyScreen.tsx`
- `apps/web/src/components/lobby/MatchmakingWaiting.tsx`
- `apps/web/src/components/lobby/OpponentFound.tsx`
- `apps/web/src/components/play/BattleScreen.tsx`
- `apps/web/src/hooks/useMatchSocket.ts`
- `apps/web/src/hooks/useQueueSocket.ts`
- `apps/web/src/lib/solana/signDepositIntent.ts`
- `packages/shared-types/src/websocket.ts`

Replaced the public matchmaking long-poll flow with a dedicated `/queue` WebSocket, reduced Phantom deposit latency by prebuilding transactions before wallet approval, and hardened room recovery so reconnects and late joins can safely resync instead of getting stuck behind stale room state.

**What changed:**

1. **Queue moved to WebSocket events:** Added `/queue` as a dedicated WS route plus shared event types for `queueJoined`, `queueStatus`, `matchFound`, `queueLeft`, and `cancelQueue`.
2. **Frontend queue hook:** Added `useQueueSocket()` and rewired `LobbyScreen` to use realtime queue updates instead of the old HTTP waiting flow and periodic presence self-heal.
3. **Visible queue position:** The waiting UI now shows live queue position and depth from backend WS broadcasts.
4. **O(1) room lookup:** Added a reverse player-to-room index in `Store` so reconnect and active-room checks do not need full room scans.
5. **Safer public room recovery:** Before queueing, the backend now releases incomplete public deposit rooms and ignores zombie deposit rooms that no longer have timers, sockets, or deposits.
6. **Zombie janitor:** Added a periodic public-room cleanup pass to destroy orphaned deposit rooms before they can trap players.
7. **Late-join deposit recovery:** If player B reconnects after being unlocked but before confirming deposit, the server now re-sends `depositUnlocked`.
8. **Snapshot-based room sync:** Added `requestSnapshot` handling on the room socket so the client can explicitly request a fresh room state and presence rebroadcast.
9. **Match socket retry logic:** `useMatchSocket()` now retries room connection and snapshot recovery instead of failing permanently on the first transient close.
10. **Single-start protection:** Added lifecycle guards so the engine cannot double-initialize when both deposits and reconnect events race each other.
11. **Phantom prompt speedup:** Split deposit signing into `prepareDepositIntentTransaction()` and `sendDepositIntentTransaction()`, allowing the FE to prefetch the unsigned tx before the user clicks approve.
12. **Removed extra RPC round-trip:** Dropped the explicit simulation before `sendTransaction` and increased error classification coverage for aborts, wallet cancellation, and backend/network failures.
13. **Faster Blink tx building:** Added short-lived blockhash caching in `BlinkTransactionBuilder` so repeated transaction generation does not keep paying the full RPC latency cost.
14. **Battle handoff polish:** The opponent-found flow now waits for a real playable room snapshot before launching the battle screen, with a short countdown once sync is ready.

**The Reasoning:**

- The biggest remaining queue fragility came from HTTP request lifetime and frontend guesswork around whether the player was still queued. A websocket-native queue replaces that uncertainty with explicit server-pushed state.
- Phantom UX was being slowed down by work that happened too late in the click path. Preparing the transaction earlier makes wallet approval feel much faster, especially over tunnels or slower RPC links.
- Room start and reconnect are now multi-step distributed flows: queue match, deposit unlock, socket join, engine init, and play snapshot. Once those phases overlap, explicit resync paths and lifecycle guards matter more than optimistic assumptions.

**Test:**

- Attempted: `bun test apps/api/test/RoomManager.test.ts`
- Current result: blocked before test execution by an external Goldrush dependency returning `401 Invalid or missing API key`

**Tech Debt:**

- The old HTTP `/match` path still exists for compatibility. The queue is now websocket-native, but matchmaking entrypoints are temporarily split across both styles.
- `RoomManager` lifecycle, reconnect, and cancellation logic is becoming state-machine-shaped. It works, but the branching surface is large enough that a formal statechart would reduce future regressions.
- The RoomManager test suite still touches dependencies that expect external credentials. Those boundaries should be isolated so room lifecycle tests can run fully offline.

---

## 21. Base Damage Rebalance (2026-05-11)

**The Change:**

_Files touched:_ `packages/game-logic/src/GameEngine.ts`, `packages/shared-types/src/characterStats.ts`, `apps/api/src/managers/room/Blockchain.ts`, `packages/battle-anchor-032/programs/cora-battle/src/constants.rs`, `packages/battle-anchor-032/tests/*`, `packages/game-logic/test/GameEngine.test.ts`

- Reduced `GameEngine.BASE_DAMAGE` from `50` to `10`.
- Added derived max-effect constants in `GameEngine` so balance limits are computed from base damage/heal plus the max phase/specialty multiplier.
- Exposed `MAX_SPECIALTY_MULTIPLIER` from shared character stats instead of duplicating the `1.5x` assumption elsewhere.
- Updated MagicBlock manifest registration to use `GameEngine.MAX_DAMAGE` and `GameEngine.MAX_HEAL`, keeping ER card limits aligned with gameplay balance.
- Lowered the ER program's `MAX_EFFECT_VALUE` from `150` to `30` so the on-chain manifest envelope matches the new gameplay ceiling.

**The Reasoning:**

- Damage balance should have one source of truth. Lowering base attack damage without updating ER manifests or the program ceiling would keep oversized attack slots registered on-chain and make future balance changes easier to miss.

---

## 22. Bot Practice Matches - Queue Fallback With ER Gameplay (2026-05-18)

**The Change:**

_Files touched:_ `packages/shared-types/src/websocket.ts`, `packages/game-logic/src/GameEngine.ts`, `apps/api/src/managers/RoomManager.ts`, `apps/api/src/managers/room/*`, `apps/api/src/routes/match.ts`, `apps/web/src/lib/matchmaking/queueMatch.ts`, `apps/web/src/hooks/useQueueSocket.ts`, `apps/web/src/hooks/useMatchSocket.ts`, `apps/web/src/components/lobby/*`, `apps/web/src/components/deposit/depositTypes.ts`, `apps/web/src/components/play/BattleScreen.tsx`, `apps/web/src/components/play/BattleScreenOverlays.tsx`

- Added a `bot` room type and `POST /match/bot` endpoint. The endpoint removes the player from the public queue, creates a room with a generated valid bot pubkey, randomly assigns the bot character, and marks both participants as deposited so the room can enter setup without Phantom signing.
- Bot matches still initialize the normal `GameEngine` and MagicBlock ER setup when ER is configured. Settlement/refund/anti-cheat payout branches are skipped for bot rooms because no escrow is funded.
- Added a server-side bot loop that opens cards, answers after a human-like delay, prefers attack cards, and uses heal cards when damaged. Bot accuracy is intentionally moderate so it can fight back without feeling like a perfect answer machine.
- Added a queue screen "Play With Bot" button and a slow-queue prompt after 15 seconds offering "Play With Bot" or "Keep Queueing".
- Updated the deposit handoff UI so bot rooms skip deposit signing, show practice/arena-prep messaging, and launch battle once a playable room snapshot arrives.
- Updated result and surrender copy so winning against a bot says no Solana is awarded, while losing/surrendering says no Solana was lost.

**The Reasoning:**

- Bot rooms reuse the same room socket, engine, card, and ER paths as human matches, which keeps gameplay behavior close to production and avoids a separate practice-mode engine.
- The bot uses a real generated Solana pubkey because the ER battle session expects player addresses even though no bot wallet signs or receives payout.
- Payout logic is explicitly skipped at the backend instead of relying on frontend wording. This prevents accidental settlement attempts for unfunded practice rooms.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit`
- `node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit`
- `node_modules/.bin/tsc.cmd -p packages/game-logic/tsconfig.json --noEmit`
- `bun test packages/game-logic/test/GameEngine.test.ts` (`21 pass`; first sandboxed run hit EPERM reading `characterStats.ts`, approved rerun passed)
- `npm run build --workspace=web`

**Tech Debt:**

- Bot tuning constants are currently server-local. If practice mode becomes a product feature, move bot difficulty profiles into a config surface and expose easy/normal/hard.
- There is no dedicated API room lifecycle test for bot rooms yet. The current API test suite still has external-service coupling, so an offline RoomManager boundary test should be added once those dependencies are isolated.

---

## 23. Guest Practice Login - Bot-Only Access (2026-05-18)

**The Change:**

_Files touched:_ `apps/web/src/components/lobby/LobbyScreen.tsx`, `apps/web/src/components/lobby/LobbySetup.tsx`, `apps/web/src/components/lobby/CharacterSelect.tsx`, `apps/web/src/components/lobby/OpponentFound.tsx`, `apps/web/src/components/play/BattleScreen.tsx`, `apps/web/src/lib/session/matchSession.ts`

- Added a guest lobby mode that generates a temporary Solana-format public address in the browser and stores it with the local active match session.
- Guest mode bypasses normal public queue entry and starts only `/match/bot`; wallet, deposit, and Blink flows remain wallet-only.
- Updated `/play` session gating so a guest can enter only when the local session is marked `isGuest: true` and `roomType: "bot"`.
- Added top-of-screen practice wallet notices in the bot found handoff and battle screen. Guest copy explains that both the guest address and bot address are generated practice addresses used only for CORA's ER game state.

**The Reasoning:**

- Reusing bot rooms keeps guest practice on the same engine, socket, and ER gameplay path without weakening real wager flows.
- The guest address is stored only as a local practice identity. It is intentionally not treated as an authenticated wallet and cannot enter public matchmaking or create funded challenges.
- The play-screen guard is explicit about `isGuest + bot` so a generated address cannot accidentally become a general login method.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit`
- `npm run build --workspace=web`

**Tech Debt:**

- Guest identity is session-local and browser-only. If guest retention becomes important, add a clearer account upgrade path from guest practice to wallet login.

**Follow-up (2026-05-18):**

- Added the guest entry point to `/connect` via `ConnectWalletScreen`, not only the lobby setup screen. The connect page now stores a generated guest address and opens `/lobby?guest=1`, where the lobby initializes directly in guest-practice mode.
- Updated connect page copy/metadata so Phantom is clearly for wager features while guest mode is bot-only practice.

**Follow-up (2026-05-19):**

- Removed the leftover lobby-level "Play As Guest" CTA and guest-address footer after a user has already entered guest mode from `/connect`.
- Replaced the lobby footer copy with: "You entered as guest. Please connect your wallet to unlock deposits and all possibilities of CORA."
- Suppressed wallet-disconnected and wallet-select UI during guest bot setup, since guest play intentionally has no wallet.
- Removed the duplicate top subtitle from bot match setup; the no-deposit/practice preparation copy remains in the lower status panel.

**Follow-up 2 (2026-05-19):**

- Fixed guest mode persistence after a completed bot match. Returning to `/lobby` now rehydrates guest mode from the stored generated guest address when no wallet is connected.
- If the user later connects Phantom while not already in a guest match, the lobby switches back to wallet mode so full queue/deposit/Blink flows unlock normally.

---

## 24. Bot Practice Question Pool Separation (2026-05-19)

**The Change:**

_Files touched:_ `apps/api/src/questions.ts`, `apps/api/src/managers/room/Engine.ts`, `apps/api/test/questions.test.ts`, `apps/web/src/components/lobby/OpponentFound.tsx`, `apps/web/src/components/play/BattleScreen.tsx`

- Added `loadPracticeQuestions()` so bot matches load only `data/questions/pool.json`.
- Updated bot room engine initialization to skip the Supabase `get_match_deck` path entirely, while public/private real matches still use the existing Supabase-backed question flow.
- Added a focused API test proving practice questions are loaded from `pool.json` only.
- Updated the practice wallet notices in both the bot handoff and battle screen to explain that bot questions use the practice pool, not the real match deck, and invite players to log in with a wallet for the full CORA experience.

**The Reasoning:**

- Bot practice should be useful for onboarding without exposing or reusing the real competitive deck from Supabase.
- Keeping the split at engine initialization preserves the normal room/socket/gameplay path while changing only the question source for `roomType === "bot"`.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit`
- `node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit`
- `bun test apps/api/test/questions.test.ts` (`5 pass`; first sandboxed run hit EPERM reading `packages/shared-types/src/question.ts`, approved rerun passed)

**Tech Debt:**

- Real match JSON fallback still uses the legacy all-files local loader. If Supabase fallback needs to mirror production more tightly, split `questions.json` into its own real-match fallback loader too.

**Copy Follow-up (2026-05-19):**

- Shortened the bot practice wallet notice in `OpponentFound.tsx` and `BattleScreen.tsx` to a compact practice-mode warning with a wallet CTA.

---

## 25. Bot Match Retry Recovery (2026-05-19)

**The Change:**

_Files touched:_ `apps/web/src/components/lobby/LobbyScreen.tsx`, `apps/api/src/managers/RoomManager.ts`, `apps/api/test/RoomManager.test.ts`

- Added a 10-second timeout to the lobby `Play With Bot` request. If `/match/bot` does not respond in time, the request aborts, the busy state unlocks, and the player can press `Play With Bot` again.
- Updated bot room creation so stale bot rooms are replaced instead of reused when they are settling, already inactive, or were created but never joined by the human player.
- Added focused RoomManager coverage for replacing stale settling bot rooms and unjoined bot rooms after a client retry.

**The Reasoning:**

- Creating a bot room should be a fast API response; 10 seconds is enough to cover slow local tunnels without leaving the button locked forever.
- Bot rooms have no escrow payout/loss, so replacing stale practice rooms is safer than routing the player back into a room that is already ending or waiting for delayed cleanup.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit`
- `node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit`
- Attempted `bun test apps/api/test/RoomManager.test.ts --test-name-pattern createBotMatch`; blocked before tests by the existing Goldrush dependency error: `401 Invalid or missing API key`.

**Tech Debt:**

- `RoomManager.test.ts` still imports paths that touch external Goldrush configuration before tests can run. The room-manager test harness needs dependency isolation so lifecycle tests can run offline.

---

## 26. Practice Pool Deduplication And Expansion (2026-05-19)

**The Change:**

_Files touched:_ `data/questions/pool.json`, `apps/api/src/managers/room/Blockchain.ts`, `apps/api/.env.example`, `apps/api/test/questions.test.ts`

- Replaced the duplicate-heavy practice pool with 128 unique bot-practice questions.
- Kept the same question schema as `questions.json`: `id`, `category`, `questionText`, four `options`, one correct `score`, and `explanation`.
- Balanced the pool across `sequence`, `logical`, and `math` categories while keeping the difficulty easier than the competitive deck.
- Raised the MagicBlock inline manifest default/guidance to 128 pre-registered card slots so longer bot matches do not run past the committed ER manifest window.
- Updated the local ignored API env's `CORA_BATTLE_PRE_REGISTER_CARD_LIMIT` value to 128 for the current dev setup.
- Added an API regression test that asserts the practice pool has 128 questions, no duplicate IDs/text, and no exact `questionText` overlap with `questions.json`.

**The Reasoning:**

- Guest-vs-bot practice can consume more than the old 20/24 committed ER manifest slots during longer matches. A larger pool plus a larger manifest window gives MagicBlock setup enough unique card slots and removes repeated question fatigue.
- Keeping practice content distinct from `questions.json` preserves the separation between onboarding practice and the real competitive deck.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit --tsBuildInfoFile .codex-api-check.tsbuildinfo`
- `bun test apps/api/test/questions.test.ts` (`6 pass`; sandboxed runs still hit EPERM reading `packages/shared-types/src/question.ts`, approved rerun passed)

**Tech Debt:**

- `GameEngine` still pre-generates up to 100 cards per match even though the practice pool now contains 128 questions. If we want every practice question to be reachable in one match, raise the engine queue cap and re-check ER account limits together.

---

## 27. Bot Practice Card Open Desync Recovery (2026-05-20)

**The Bug:**

A bot-practice player could get stuck after the backend logged:

`Player <address> tried to play card <cardId> without opening it first in room bot-...`

The room engine required every `playCard` to match a tracked `openedCards` entry. If the frontend had already moved into answer UI but the backend had lost, rejected, or cleared the `openCard` state, `handlePlayCard()` returned silently. The card was not played, no `playCardResult` or `cardExpired` event was sent, and the frontend stayed locked waiting for a terminal card event.

**The Change:**

_Files touched:_ `apps/api/src/managers/room/Engine.ts`, `apps/api/test/RoomManager.test.ts`

- Added backend recovery for bot-practice rooms: if `playCard` arrives without tracked open state but the card is still in the player's current hand, the backend processes the answer instead of dead-ending the UI.
- Kept public/private matches strict: playing without opening still does not apply damage/heal, but now sends `cardExpired` plus a fresh game-state snapshot so the client unlocks.
- Re-sends the current countdown when a player tries to open a card while one is already open, helping reconnect or duplicate-open cases resync.
- Clears stale opened-card records when the tracked card is no longer in the player's hand, so stale backend state cannot block future opens.
- Added RoomManager regression coverage for the strict public path and the bot-practice recovery path.

**The Reasoning:**

- The bug was a backend/client state desync, not a wrong answer validation issue. The unsafe part was the silent return: the UI needs a terminal event for every attempted answer.
- Practice bot rooms have no wager, so recovering a missing `openCard` by accepting the still-in-hand answer is better UX and low risk.
- Real wager rooms keep the server-side open-before-play invariant, but now fail closed with a client-unlocking event instead of freezing.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit` passed.
- Attempted `bun test apps/api/test/RoomManager.test.ts --test-name-pattern playCard`; blocked before test execution because Bun in this local environment cannot resolve `@solana/web3.js` from `RoomManager.ts`, even though Node/npm can resolve the installed package.

**Tech Debt:**

- `RoomManager.test.ts` still needs dependency isolation from Solana/MagicBlock imports so room lifecycle tests can run under Bun without loading the full blockchain stack.

---

## 28. Card Open ACK And Rejection Contract For FE (2026-05-20)

**The Change:**

_Files touched:_ `packages/shared-types/src/websocket.ts`, `apps/api/src/managers/room/Engine.ts`, `apps/api/test/RoomManager.test.ts`

- Added `openCardAccepted` server event with `{ cardId, remainingMs }`.
- Added `cardActionRejected` server event with `{ action, reason, cardId?, activeCardId?, recoverable, message }`.
- Added explicit rejection reasons: `game_not_active`, `invalid_payload`, `not_in_hand`, `already_open`, `not_opened`, and `different_card_open`.
- `openCard` now behaves as the server-side check-and-open request. FE does not need a separate pre-check request.
- Successful opens still emit `cardCountdown` for backward compatibility, but FE can now treat `openCardAccepted` as the real modal/answer-enable ACK.
- Rejected opens/plays emit `cardActionRejected`, a fresh game-state snapshot when useful, and a legacy `cardExpired` with `reason: "rejected"` so the current FE can still unlock during migration.
- Real public/private matches remain fail-closed: rejected `playCard` does not mutate the engine hand, does not apply damage/heal, and does not consume a MagicBlock ER slot.
- Bot practice still recovers a missing open state when the answered card is still in the server hand, keeping no-stakes practice smooth.

**The Reasoning:**

- The frontend should not add a separate "is this card open?" request because that adds latency and still races. The existing `openCard` request should be the authoritative ACK boundary.
- `cardCountdown` was an implicit ACK. `openCardAccepted` gives FE a clean signal: enable answers only after this event for the clicked card.
- `cardActionRejected` lets FE show honest sync-copy such as "Card sync lost. Please reopen the card." instead of treating every rejection as a timeout.

**FE Implementation Notes:**

- On card click: send `openCard`, set a lightweight pending/syncing state, and do not enable answer buttons yet.
- On `openCardAccepted` matching the pending card: open/enable the answer UI and start displaying `remainingMs`.
- On `cardActionRejected`: close pending/active answer UI, show `payload.message`, refresh from the next `gameStateUpdate`, and let the player reopen.
- On `cardExpired`: treat omitted `reason` or `reason: "timeout"` as a true timeout. Treat `reason: "rejected"` as a legacy unlock signal and avoid counting it as a player timeout once `cardActionRejected` is handled.

**Test:**

- `node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit --tsBuildInfoFile .codex-api-check.tsbuildinfo` passed.
- `node_modules/.bin/tsc.cmd -p apps/web/tsconfig.json --noEmit --tsBuildInfoFile .codex-web-check.tsbuildinfo` passed.
- Attempted `node_modules/.bin/tsc.cmd -p packages/shared-types/tsconfig.json --noEmit`; skipped because `packages/shared-types` has no `tsconfig.json`.
- Attempted `bun test apps/api/test/RoomManager.test.ts --test-name-pattern "card|playCard|openCard"`; blocked before test execution because Bun cannot resolve `@solana/web3.js` from `RoomManager.ts` in this local environment.

**Tech Debt:**

- After FE fully handles `cardActionRejected`, we can remove the transitional `cardExpired(reason: "rejected")` compatibility event.
