# Backend Development Log


## 2026-04-27 - Scaffold Bun + Hono API

**The Change:**
- Created `apps/api/package.json` with Hono and Bun types.
- Added strict `apps/api/tsconfig.json` tailored for Bun.
- Configured flat-config ESLint (`apps/api/eslint.config.mjs`) to enforce TypeScript code quality.
- Created `apps/api/.env.example` with standard ports and placeholder for `SERVER_KEYPAIR`.
- Set up initial `apps/api/src/index.ts` with a `/health` endpoint.

**The Reasoning:**
- **Bun + Hono:** Chose Bun as the runtime and Hono as the web framework per the architecture outlined in `MASTER.md`. This combination is lightweight and exceptionally fast for edge and WebSocket applications.
- **Manual Scaffolding:** Due to the local environment lacking the `bun` CLI temporarily, files were scaffolded manually to unblock development. The configuration mirrors a standard `bun create hono` setup but includes stricter linting and TS paths from day one.

**The Tech Debt:**
- **No Test Runner:** We haven't configured `bun test` or Jest yet. We'll need to add testing as we start building logic.
- **Local Dev Environment:** The user still needs to install Bun locally (`powershell -c "irm bun.sh/install.ps1 | iex"`) to actually run the server.

## 2026-04-27 - Backend WebSocket Integration

**The Change:**
- Updated `apps/api/tsconfig.json` to map `@shared/*` to `packages/shared-types`, enabling strict typing across frontend and backend.
- Replaced `index.ts` with a `hono/bun` implementation of WebSockets exposing `/match/:roomId`.
- Implemented mock server game state logic natively in the API to replace the `scripts/mock-ws-server.js` script.
- Updated `PORT` default in `.env.example` and `index.ts` to `8080`.

**The Reasoning:**
- **Seamless Integration:** Porting the exact logic from the frontend's mock WebSocket server means the frontend `useMatchSocket` hook can connect seamlessly out of the box without any refactoring.
- **Contract-First:** Leveraging `tsconfig.json` path mappings ensures both packages rely on the exact same type definitions (`GameState`, `WsMessage`), which prevents drift and enforces strict payloads.

**The Tech Debt:**
- **Mock Logic:** The `/match/:roomId` endpoint is currently hardcoded to simulate a 1-second delay and modify state in a purely mock fashion. This needs to be replaced with the actual Smart Contract parsing / Game loop engine in the future.

## 2026-04-27 - WebSocket Gateway & Room Manager

**The Change:**
- Created `apps/api/src/managers/RoomManager.ts` to encapsulate active rooms, clients, and state broadcasting.
- Implemented `joinRoom`, `leaveRoom`, `reconnect`, and `10s disconnect timeout` forfeit logic in `RoomManager`.
- Refactored `apps/api/src/index.ts` to instantiate `RoomManager` and delegate WebSocket lifecycle events.
- Added a POST `/match` endpoint for FIFO matchmaking which creates and returns a `roomId`.
- Added a test script `apps/api/scripts/test-ws.ts` to simulate and verify connection and reconnection flows.

**The Reasoning:**
- **State Management:** Tracking connections (`ServerWebSocket`) and game state in an in-memory Map handles the MVP requirement for real-time WebSocket state management efficiently.
- **Resilience:** A 10-second timeout mechanism allows users facing spotty connections to reconnect and resume immediately, improving the gameplay UX. 
- **Decoupled Architecture:** Separating connection logic (`index.ts`) from room logic (`RoomManager.ts`) keeps the API layer clean.

**The Tech Debt:**
- **In-Memory State:** Rooms are stored entirely in-memory (`Map`). This does not scale horizontally across multiple instances (e.g., requires Redis in the future).
- **Matchmaking Identifier:** We require the client to pass their address as a query param `?address=` to authenticate and handle reconnects, which isn't currently sent by the frontend's `useMatchSocket.ts` hook.

## 2026-04-27 - True FIFO Matchmaking Queue

**The Change:**
- Replaced instant-return logic in `apps/api/src/managers/RoomManager.ts` with a true queue mechanism (`queueMatch`).
- Modified `POST /match` in `apps/api/src/index.ts` to require a JSON body `{"address": "0x..."}` and await the `queueMatch` promise, effectively implementing long-polling.
- Handled aborted HTTP requests via `c.req.raw.signal` to automatically drop disconnected users from the queue.
- Updated `apps/api/scripts/test-ws.ts` to simulate concurrent matchmaking requests properly.

**The Reasoning:**
- **True Pairing:** The previous implementation instantly returned a room ID before a second player was even present. A proper queue holds the HTTP request open and pairs two unique addresses together, delivering a synchronized `roomId` to both players at exactly the same time. This aligns with the "auto-pair two queued players" requirement in `MASTER.md`.
- **Long-Polling Simplicity:** Using HTTP long-polling for matchmaking is clean and stateless, deferring WebSocket connection until the match is confirmed, saving resources.

**The Tech Debt:**
- **In-Memory Queue:** Similar to rooms, the matchmaking queue is held in a Node/Bun array. It will not scale horizontally across multiple instances without a centralized broker like Redis.
- **Queue Timeouts:** Currently, a long-polling request can stay open indefinitely until a pair is found or the connection aborts. We may need to enforce a maximum wait time (e.g., 30s timeout) and return an explicit `408 Request Timeout` if unfulfilled.

## 2026-04-27 - Game Session Manager State Machine

**The Change:**
- Refactored `GameStatus` in `packages/shared-types/src/websocket.ts` to strictly adhere to the `waiting` -> `depositing` -> `playing` -> `finished` state machine.
- Added a new `confirmDeposit` event to `ClientToServerEvents` to allow the frontend to signal when a user's Solana transaction is complete.
- Updated `RoomManager.ts` to transition rooms to the `depositing` state once 2 players connect.
- Implemented logic to require both players to send the `confirmDeposit` message before transitioning the room state to `playing` and allowing cards to be played.
- Replaced the generic `match_ended` state with the explicit `finished` state across all win/forfeit conditions.
- Updated `test-ws.ts` to verify the full flow including the deposit confirmation.

**The Reasoning:**
- **Explicit Game Flow:** Enforcing this specific state machine maps perfectly to the architectural flow defined in `MASTER.md`, where the on-chain escrow transaction occurs *before* the off-chain game loop can begin.
- **Client-Driven Confirmation:** For the MVP, allowing the frontend to broadcast `confirmDeposit` keeps the architecture simpler than implementing complex on-chain event listeners. The backend trusts this message to unblock the match.

**The Tech Debt:**
- **Trusting the Client:** Currently, the server blindly trusts the `confirmDeposit` message. In a production environment, the backend *must* receive the transaction signature in this payload and verify it against the Solana RPC to ensure the funds actually landed in the escrow PDA before unlocking the `playing` state.

## 2026-04-27 - GET /api/questions Endpoint & Pool JSON

**The Change:**
- Created a sample JSON file at `data/questions/pool.json` containing 8 logic and math GAT questions.
- Added a `GET /api/questions` route in `apps/api/src/index.ts`.
- Implemented file reading logic using `Bun.file()` to fetch the questions from `pool.json`.
- Implemented shuffling logic that selects 5 randomized questions from the pool and returns them in a standard JSON format.

**The Reasoning:**
- **Decoupled Data:** Storing the question bank in a simple `.json` file inside `data/questions/` allows data to be easily managed independently of application code, following the MVP boundaries defined in `MASTER.md`.
- **Match Gameplay Requirements:** The endpoint randomly shuffles and limits questions to 5, which meets the requirement of providing fresh questions per game.

**The Tech Debt:**
- **In-Memory Shuffling Risk:** We read the JSON file directly and shuffle elements in memory. If the question bank grows to thousands of items, reading the full parsed JSON and slicing may impact memory and performance. We'd ideally want to use an actual database (e.g., PostgreSQL or Turso) with a randomized query limit approach eventually.

## 2026-04-27 - Security Middleware (CORS & Rate Limiter) added

**The Change:**
- Added Hono's native `cors` middleware (`hono/cors`) as a global middleware on `/*`.
- Created a custom in-memory rate limiter middleware at `apps/api/src/middleware/rateLimiter.ts`.
- Registered `rateLimiter` globally on `/*` before hitting the application routes.
- Limited each IP to 60 requests per minute with an automated 1% chance memory cleanup trigger.

**The Reasoning:**
- **CORS Requirements:** The frontend (e.g., `localhost:3000`) and the Blink (browser extensions) require CORS headers to execute cross-origin requests to the backend (`localhost:8080`).
- **Abuse Prevention:** Opening the API publicly immediately invites bots. The in-memory map rate limiter prevents simple spam (DDoS on the WebSocket allocator or mass-scraping of the question pool) while keeping implementation lightweight and dependency-free.
- **Health Check Enhancement:** The `/health` route is now protected and accessible via CORS without requiring authentication, allowing uptime monitoring services to ping it freely.

**The Tech Debt:**
- **In-Memory Rate Limiter limitation:** Just like the WebSocket rooms, keeping a `Map` of IPs in local memory will fail once the backend is load-balanced across multiple instances. Rate limits will be per-instance. Eventually, this needs to be decoupled into a Redis cache (Upstash) or rely on edge infrastructure controls (like Cloudflare/Vercel rate-limiting) instead of application-level limiting.

## 2026-04-27 - Server Keypair & Settlement Signature

**The Change:**
- Installed `@solana/web3.js`, `bs58`, and `tweetnacl` to handle Solana cryptography natively in Bun.
- Created `apps/api/src/utils/settlement.ts` which loads `SERVER_KEYPAIR` from `.env`.
- Added support for both `[1, 2, ...]` (JSON array array) and `bs58` string formats for the keypair storage.
- Added `signSettlementAuthorization(matchId, winnerAddress)` that executes an Ed25519 signature over a deterministic payload (`SETTLE:<matchId>:<winnerAddress>`).

**The Reasoning:**
- **Zero-Trust Client:** As outlined in the architecture, the client cannot be trusted to report who won. The server determines the winner, signs the result cryptographically, and this signature is verified by the Solana smart contract (Anchor) inside the `settle_match` instruction.
- **Payload Determinism:** Standardizing the message buffer to a strict `SETTLE:<matchId>:<winnerAddress>` format makes it easy for the Rust Anchor backend to recreate the exact payload and verify the Ed25519 signature before releasing the escrowed funds.

**The Tech Debt:**
- **Calling the Contract:** The `settlement.ts` module currently only *generates* the signature. To fully implement "Server can call settle_match", we will need to install `@coral-xyz/anchor`, import the IDL, and write the RPC call to push the transaction on-chain on behalf of the server. Currently, we just have the cryptographic auth ready.

## 2026-04-28 - Question Delivery Pipeline (Per-Card Countdown, Answer Validation, Live Scores)

**The Change:**
- Updated `packages/shared-types/src/websocket.ts` to add new cross-team WS events:
  - `openCard` (client → server): player opens/selects a card to start the answer countdown.
  - `cardCountdown` (server → client): 1-second ticks with `remainingMs` for the opened card.
  - `cardExpired` (server → client): notifies player their card timed out.
  - `scoreUpdate` (server → client): per-player live scores and health after every card play/expiry.
  - `playCardResult` (server → client): formalized in the type contract (was already emitted but missing from `ServerToClientEvents`).
  - Added `CardCountdownData`, `CardExpiredData`, `ScoreUpdateData` interfaces.
- Refactored `apps/api/src/managers/RoomManager.ts`:
  - Added `OpenedCard` interface tracking per-player card state (cardId, openedAt, countdown interval, timeout handle).
  - Added `openedCards: Map<string, OpenedCard>` to the `Room` interface.
  - Added `handleOpenCard()`: validates card in hand, starts 10-second countdown with 1s ticks, schedules auto-expiry timeout.
  - Added `expireCard()`: on timeout, calls `engine.playCard()` with an invalid option (`'__timeout__'`) so the engine treats it as a wrong answer — card consumed, new card dealt, no damage/heal. Emits `cardExpired` event.
  - Modified `handlePlayCard()`: now requires the card to have been opened first via `openCard`. Clears the countdown on valid answer. Rejects plays for cards that weren't opened or already expired.
  - Added `broadcastScoreUpdate()`: after every play (success or expiry), sends per-player `scoreUpdate` with current scores and health to both players.
  - Added `clearOpenedCard()` / `clearAllOpenedCards()` helpers for cleanup on answer, game over, and forfeit.
  - Wired `openCard` message type in `handleMessage()`.

**The Reasoning:**
- **Per-Card Countdown:** The existing model had no time pressure per question — only a global 5-minute match timer. Players could hold cards indefinitely. Adding a 10-second per-card countdown after opening creates real-time pressure and matches the game design intent.
- **Server-Side Enforcement:** The countdown and timeout are enforced entirely server-side. The client sends `openCard`, receives countdown ticks, and must send `playCard` within the window. Late plays are impossible because the server auto-expires the card via `setTimeout`.
- **Zero Game-Logic Changes:** The timeout trick (`engine.playCard(address, cardId, '__timeout__')`) leverages the existing engine behavior — any non-matching option is treated as a wrong answer, consuming the card and dealing a new one. This avoids touching `packages/game-logic` (GAME role's territory).
- **Live Score Broadcasts:** `scoreUpdate` events after every play give the FE real-time data for score animations without having to parse the full `gameStateUpdate` payload.

**The Tech Debt:**
- **One Card at a Time:** Currently enforced that a player can only have one card open at a time. If the game design evolves to allow multiple simultaneous opened cards, the `openedCards` tracking would need to change from `Map<string, OpenedCard>` to `Map<string, Map<string, OpenedCard>>`.
- **Rate Limit Interaction:** The engine's internal 500ms rate limit could theoretically conflict with an `expireCard` call that fires right after a manual play. In practice this is unlikely because the player can only have one card open, but worth monitoring.
- **FE Integration:** The frontend hook (`useMatchSocket.ts`) needs to be updated by the FE team to handle the new `openCard` → `cardCountdown` → `playCard` / `cardExpired` → `scoreUpdate` flow.

## 2026-04-29 - Match Result Determination: 5 rounds
**The Change:**
- Enhanced match engine to support multi-round gameplay, tracking \`roundsWon\` for each player via \`PlayerState\` and \`EnginePlayerState\`. Defaults to a first-to-2 points structure for a "best of 3" experience.
- Tracked round ending conditions where a player's HP drops below 0 or by timer, emitting a new \`roundOver\` event before automatically resetting states without halting the internal game system loops.
- Hooked \`gameOver\` inside \`RoomManager\` to ensure \`FINISHED: Winner determined server-side\` is logged to confirm the server's authoritative decision correctly aligns.

**The Reasoning:**
- **Match Format Iteration:** A round-based game is intrinsically more competitive, mitigating RNG/luck of a single good hand draw. First to 3 / 2 wins scales match intensity higher alongside the token wagers. 
- **Separation of Concerns:** Instead of destroying the full game state on win, \`roundOver\` merely resets combat parameters while preserving score arrays & anti-cheat evaluations gracefully across multiple match phases.

**The Tech Debt:**
- **Frontend Syncs:** While the API properly emits \`roundOver\` inside the \`GameState\` stream, the frontend relies on single-session logic right now and needs UX implementation to animate round transition graphics (like screen wipes and scoreboard ticks).

## 2026-04-30 - Settlement Oracle & On-Chain Anti-Cheat

**The Change:**
- Updated `buildSettlementMessage` in `packages/shared-types/src/escrow.ts` to generate a 65-byte binary buffer instead of a string, adding an `action` byte (0 for Normal, 1 for Anti-Cheat) and using decoded `targetAddress`.
- Implemented `submitSettlementTransaction` in `apps/api/src/utils/settlement.ts` using `@solana/web3.js`. It constructs and signs the `global:settle_match` Anchor instruction and sends it directly to the Solana RPC.
- Modified `RoomManager.ts` to act as an automated oracle:
  - Normal match completion automatically submits the transaction with `action = 0`.
  - If `AntiCheatVerdict` returns `rejected`, it halts normal settlement and auto-submits an anti-cheat penalty transaction with `action = 1`, targeting the cheater.
- Refactored `settlement.test.ts` to use valid Base58 encoded mocks and validated the new 65-byte deterministic signature format. All 53 tests pass.

**The Reasoning:**
- **Smart Contract Alignment:** The Web3 dev updated the Solana program to handle anti-cheat natively. This required matching the exact 65-byte payload expected by the on-chain `ed25519` signature verification.
- **Oracle Automation:** By having the backend automatically craft and submit the transaction at the end of the match, we remove the need for the client to pay gas for settlement or manually claim their winnings.
- **Immediate Penalties:** Tying the game engine's Anti-Cheat directly into the Solana transaction means cheaters instantly forfeit their wagers on-chain without any manual admin intervention.

**The Tech Debt:**
- **Manual Account Parsing:** To keep the API lightweight and avoid pulling in the massive `@coral-xyz/anchor` IDL types, `settlement.ts` manually reads the `MatchState` buffer offsets (e.g., `subarray(40, 72)` for `playerA`). If the Rust state struct changes, this manual parsing will break silently.
- **Lack of Retry Queue:** If the Solana RPC drops the `submitSettlementTransaction` call (e.g., due to network congestion), it currently just logs to `console.error`. We need a robust background job queue (like BullMQ) to retry failed settlements until confirmed.

## 2026-05-01 - Solana Actions: GET /api/actions/challenge (Blink Metadata)

**The Change:**
- Rewrote `apps/api/src/routes/actions.ts` to be fully compliant with the [Solana Actions specification](https://solana.com/docs/advanced/actions).
- **GET `/api/actions/challenge`:** Returns an `ActionGetResponse` with:
  - `type: "action"` (required by spec, was missing before).
  - `icon` (absolute Arweave URL), `title`, `description`, `label`.
  - `links.actions[]` with three preset stake tiers (`5`, `10`, `25` USDC) plus a custom amount input.
  - Each `LinkedAction` now includes `type: "transaction"` (spec requirement).
  - Custom stake parameter uses `type: "number"` with `min`/`max` bounds and a `patternDescription`.
- **POST `/api/actions/challenge`:** Updated to read `account` from the POST body (spec says `{ "account": "<base58>" }`), replacing the previous `payer` field. Added `message` to the POST response. Error responses follow the `ActionError` interface (`{ message: string }`).
- CORS middleware updated: added `X-Blockchain-Ids` header for Solana Devnet chain identification.
- `actions.json` discovery endpoint in `index.ts` was already in place and correct.

**The Reasoning:**
- **Spec Compliance:** The previous scaffold was functional but missing several required fields (`type` on both the root response and `LinkedAction` objects). X/Twitter Blink renderers and Dialect's registry require these to properly unfurl the Blink card.
- **Preset Tiers + Custom:** Offering quick-click preset amounts (5, 10, 25 USDC) alongside a custom input follows best UX practices seen in the Solana Actions examples (e.g., `Stake 1 SOL` / `Stake 5 SOL` / custom). This reduces friction for first-time users.
- **POST Body `account`:** The spec mandates the client wallet sends `{ "account": "<base58 pubkey>" }` — not a custom `payer` param. Aligning with the spec means standard Blink clients (Phantom, Backpack, Dialect) will work out of the box.

**The Tech Debt:**
- **Memo-Only Transaction:** The POST handler currently builds a Memo instruction as a placeholder. The real flow should call `initialize_match` + `deposit_wager` on the Anchor escrow program once the Web3 team's IDL is stable. This is the next step for wiring the Blink → on-chain escrow pipeline.
- **Icon URL:** We're using a generic Arweave-hosted image. The Designer should provide a branded CORA challenge card image and we should update the `iconUrl` constant.
- **Dialect Registry:** For the Blink to auto-unfurl on X/Twitter, we need to register the domain at [dial.to/register](https://dial.to/register). Until then, the Blink only works via [dial.to](https://dial.to) interstitial or direct Action URL (`solana-action:https://...`).

## 2026-05-01 - Hybrid Matchmaking & Blinks: Full Phase 1-4 Implementation

**The Change:**

- **`packages/shared-types/src/websocket.ts`:**
  - Added `MatchFoundData` interface (`roomId`, `role: 'playerA' | 'playerB'`, `opponentAddress`).
  - Added four new `ServerToClientEvents`: `matchFound`, `matchFoundWaiting`, `depositUnlocked`, `opponentFailedDeposit`.

- **`apps/api/src/managers/RoomManager.ts`:**
  - Extended `Room` interface with: `roomType`, `playerA`, `playerB`, `playerBUnlocked`, `tokenMint`, `wagerAmount`, `depositTimeouts`.
  - Added `DEPOSIT_TIMEOUT_MS = 20_000` constant (the "shot clock").
  - Added `createPrivateRoom(playerAPubkey, tokenMint, wagerAmount)`: creates a `depositing` room for Blinks/private invites, stores token config server-side, arms Player A's 20s shot clock immediately.
  - Added `joinPrivateRoom(playerBPubkey, roomId)`: validates room, assigns Player B, returns a result code (`ok | not_found | full | cancelled`) for clean HTTP error mapping.
  - Added `cancelRoom(roomId, innocentAddress?)`: clears all shot clocks, emits `opponentFailedDeposit` to the innocent player, re-queues them at the front of the public matchmaking queue.
  - Added `armDepositTimeout(room, address)`: private helper that fires `cancelRoom` after 20s if `confirmDeposit` is not received.
  - Updated `queueMatch()`: when pairing two players, assigns `playerA` (the waiting player) and `playerB` (the incoming player), transitions room to `depositing`, arms Player A's shot clock.
  - Updated `handleDeposit()`: sequential unlock model — after Player A deposits, clears their shot clock, sends `depositUnlocked` to Player B, arms Player B's 20s shot clock. Only transitions to `playing` after both confirm.
  - Updated `leaveRoom()`: the 10s forfeit timer is now **only armed during `playing`**. A disconnect during `depositing` triggers an immediate `cancelRoom` instead (the shot clock would fire anyway, but we cancel eagerly to free the opponent sooner).

- **`apps/api/src/index.ts`:**
  - Changed `actionsRouter` from a static import to a `createActionsRouter(roomManager)` factory call so the Blink handler shares the live `RoomManager` instance.
  - Added `POST /match/private` endpoint: accepts `{ address, tokenMint, wagerAmount }`, calls `createPrivateRoom`, returns `{ roomId, blinkUrl }`. `tokenMint` and `wagerAmount` are never in the URL — only in server memory.

- **`apps/api/src/routes/actions.ts`:**
  - Fully rewrote as a factory function `createActionsRouter(roomManager)`.
  - **GET `/api/actions/challenge?roomId=<id>`**: when `roomId` is present, checks room state — returns `ActionError` for dead/cancelled/full rooms, returns targeted single-button Blink metadata for valid open rooms.
  - **POST `/api/actions/challenge?roomId=<id>`**: calls `joinPrivateRoom`, maps result codes to HTTP status codes, then builds the **real Anchor `deposit_wager` instruction** — derives `matchState` and `vault` PDAs from `ESCROW_CONSTANTS` seeds, derives the depositor's ATA via `getAssociatedTokenAddressSync`, hand-encodes the discriminator `[234, 73, 235, 136, 168, 103, 239, 207]`, serializes the `Transaction` as base64. The Memo stub is deleted.

**The Reasoning:**
- **Spoofing Prevention:** `tokenMint` and `wagerAmount` are locked into the `Room` at creation time (`POST /match/private`) and read back by the Blink handler directly from server state. This prevents a malicious actor from crafting a Blink URL with a different token mint or zero wager to drain a different vault.
- **Sequential Deposit Model:** The original simultaneous-deposit approach had a Solana race condition — both players could try to sign their transactions at the same moment, but only one can be the `initialize_match` initiator. The sequential model (A initializes + deposits first, B deposits after receiving `depositUnlocked`) matches the on-chain contract's `WaitingDeposit` state machine exactly.
- **Shot Clock as Safety Net:** The 20s deposit timeout prevents a room from being held open indefinitely if a player drops their wallet or navigates away after being paired. The innocent player is immediately re-queued at the front so they don't lose their place.
- **`leaveRoom` Gating:** Previously the 10s forfeit timer fired regardless of game state, which meant a player who closed the tab during the deposit screen would trigger a `forfeitMatch` call that tries to run the settlement oracle on a game that never started. The gate to `playing` prevents that.

**The Tech Debt:**
- **`queueMatch` role assignment**: The sequential model emits `matchFound` / `matchFoundWaiting` via the WebSocket connection that exists *after* the HTTP `/match` response. The current implementation relies on the FE immediately connecting the WebSocket after receiving `roomId` from `POST /match`. If the WS connects late, Player B could miss the `matchFoundWaiting` event. A `broadcastGameState` on WS open will catch them up, but the FE team should also handle a `gameStateUpdate` with `status: 'depositing'` and no deposit tx yet as the "waiting" signal.
- **Re-queued player WS**: When `cancelRoom` re-queues the innocent player, the resolve closure uses the room's client map which is about to be deleted. The FE will need to call `POST /match` again (new HTTP request) to properly re-enter the queue; the re-queue in `cancelRoom` is a best-effort convenience for same-session re-pairing, not a hard guarantee.
- **`winnerAddress` typo in `settlement.ts:167`**: Pre-existing bug — `winnerAddress` should be `targetAddress`. Flagged for BE to fix separately.

## 2026-05-01 - IDL Sync: Web3 Security Hardening (Entries 6–9) + Settlement Retry

**The Change:**

- **`packages/shared-types/src/escrow.ts`:**
  - Added `CONFIG_SEED: 'config'` to `ESCROW_CONSTANTS`. This matches the new `CONFIG_SEED` in `constants.rs` (Web3 Entry 6) used for the `ProgramConfig` PDA.

- **`apps/api/src/utils/settlement.ts`:**
  - **Added `config` PDA account** to `settle_match` instruction keys (position 5, between `playerBTokenAccount` and `treasury`). The Web3 team added `ProgramConfig` as a required read-only account in Entry 6 (H-1 fix — treasury validation). Without this, every `settle_match` transaction would fail with an Anchor account mismatch error.
  - **Singleton `Connection`** — replaced per-call `new Connection()` with a module-level singleton. Avoids connection churn and makes the RPC URL visible at startup via log.
  - **Retry with exponential backoff** (`withRetry`) — wraps `getAccountInfo` and `sendAndConfirmTransaction` in a 3-attempt retry loop (1s → 2s → 4s delays). Fixes the `Unable to connect` crash when RPC is transiently unreachable.
  - **Startup log** — prints `[Settlement] Using Solana RPC: <url>` at module load so misconfigured `.env` is immediately obvious.

- **`apps/api/src/routes/actions.ts`:**
  - **Removed `systemProgram`** from `deposit_wager` instruction keys. Web3 Entry 9 (Q-5) removed this unnecessary account from the Anchor instruction — `deposit_wager` has no `init`, so `system_program` was dead weight. Instruction now has 6 accounts (was 7).

- **`apps/api/.env`:**
  - Created with all required variables: `PORT`, `API_BASE_URL`, `SOLANA_RPC_URL` (pointing to devnet), `SERVER_KEYPAIR`, `TREASURY_PUBKEY`.
  - **Root cause of the `Unable to connect` error:** `SOLANA_RPC_URL` was missing, causing `settlement.ts` to fall back to `http://127.0.0.1:8899` (local validator) which wasn't running.

- **`apps/api/.env.example`:**
  - Updated to document all env vars the API reads, including `SOLANA_RPC_URL`, `API_BASE_URL`, and `TREASURY_PUBKEY`.

**The Reasoning:**

1. **Config PDA (H-1):** The Web3 team's security audit found that `settle_match` previously accepted *any* token account as treasury. The fix adds a `ProgramConfig` PDA (seeds = `["config"]`) that stores the admin-configured treasury authority. The on-chain program now validates `token::authority = config.treasury_authority` on the treasury account. Our backend must pass this PDA or the transaction is rejected.

2. **`systemProgram` removal (Q-5):** `deposit_wager` does not create any new accounts (`init`), so `system_program` was an unnecessary account meta. Removing it saves ~32 bytes per transaction.

3. **Retry logic:** Devnet RPC endpoints have transient availability issues. A fire-and-forget `submitSettlementTransaction` that crashes on first failure means real match results never settle. Exponential backoff with 3 retries handles the common case of a momentary TCP hiccup without over-taxing the RPC.

4. **`initialize_match` not built by backend:** Confirmed by searching the entire codebase — no TS code constructs `initialize_match`. This is a frontend/Blink concern. The Web3 team's removal of `rent` from `initialize_match` (Q-4) does **not** require backend changes.

**The Tech Debt:**

- [ ] **Manual MatchState parsing** — `settlement.ts` still reads raw buffer offsets (`subarray(40, 72)`) instead of using the IDL. If the Rust struct layout changes, this will silently break. Consider using `@coral-xyz/anchor` for proper deserialization.
- [ ] **No settlement retry queue** — the retry wraps a single attempt cycle. If all 3 attempts fail, the settlement is lost. A persistent job queue (BullMQ / Bun-native) should be added for production.
- [ ] **`initialize_match` in Blink flow** — currently the POST `/api/actions/challenge` only builds `deposit_wager`. Player A's `initialize_match` is not wired yet — this needs frontend or a separate Blink action endpoint.

## 2026-05-02 - Web3 Phase 3 Compatibility (Account Closing, Events, Versioning)

**The Change:**

- **`packages/shared-types/src/escrow.ts`:**
  - Added `MATCH_STATE_VERSION: 1` and `PROGRAM_CONFIG_VERSION: 1` to `ESCROW_CONSTANTS`. Mirrors the `version: u8` field the Web3 team added to `MatchState` and `ProgramConfig` in `state.rs` (Entry 10, L-4).

- **`apps/api/src/utils/settlement.ts`:**
  - **[BREAKING FIX]** Fixed MatchState binary parser byte offsets. The `version: u8` field (1 byte) was prepended to MatchState at offset 8 (after discriminator), shifting all subsequent fields by +1: `playerA` is now at `41..73` (was `40..72`), `playerB` at `73..105` (was `72..104`), `tokenMint` at `105..137` (was `104..136`). Without this fix, on-chain settlement would extract the wrong public keys and fail.
  - Updated "not found" log to mention account closing as a possible cause (match already settled/refunded → PDA purged).
  - Added post-settlement log confirming MatchState PDA and Vault closure.

- **`apps/api/src/utils/eventListener.ts` (NEW):**
  - Embedded Anchor event listener that subscribes to program logs via Solana WebSocket (`onLogs`). Decodes 6 structured events (`MatchInitializedEvent`, `WagerDepositedEvent`, `MatchSettledEvent`, `MatchRefundedEvent`, `ConfigInitializedEvent`, `ConfigUpdatedEvent`) using IDL discriminators. Parses event payloads (match IDs, pubkeys, amounts, booleans) and logs them. No external dependencies beyond `@solana/web3.js`.

- **`apps/api/src/index.ts`:**
  - Wired event listener on server boot — only activates when `SOLANA_RPC_URL` is set (skipped in local dev without RPC).

- **`apps/api/test/settlement.test.ts`:**
  - Added `MatchState v2 layout (version field)` test suite: verifies correct byte offsets using a synthetic MatchState buffer, confirms version constants default to 1.

- **`apps/api/test/RoomManager.test.ts` (Boy Scout Rule):**
  - Fixed 8 pre-existing test failures caused by missing `room.playerA`/`room.playerB` role assignments. The sequential deposit model (Phase 1-4 PR) requires roles to be set before `handleDeposit` can transition to `playing`. All `setupPlayingRoom` helpers and inline deposit setups now assign roles before depositing.

**The Reasoning:**

1. **Byte offset fix:** The Web3 PR (Entry 10, L-4) prepended `version: u8` to `MatchState`. Our settlement oracle manually parses the account buffer at hardcoded offsets to extract `playerA`, `playerB`, and `tokenMint`. A 1-byte shift in the struct silently causes the parser to read the wrong bytes — the last byte of `match_id` becomes the first byte of `playerA`, etc. This would cause every on-chain settlement to fail with `InvalidWinner` or create transactions to the wrong addresses.

2. **Account closing awareness (M-1):** The `settle_match` and `refund` instructions now use Anchor's `close = caller` constraint and a CPI `close_account` on the vault. After finalization, the MatchState PDA and Vault are permanently purged. Any subsequent `getAccountInfo` returns `null`. Our oracle already skipped if `accountInfo` is null, but the log message was misleading — it implied the match was never initialized. Updated to mention account closure as a valid reason.

3. **Event listener (L-3):** Previously the backend had no way to observe on-chain events in real-time. The Web3 PR replaced `msg!` logs with structured `emit!` events. The new listener subscribes to program logs, matches 8-byte discriminators from the IDL, and parses the Borsh-serialized fields. Embedded in the API process per team decision (vs. standalone service) for simplicity at this stage.

4. **Test fixes (Boy Scout Rule):** The 8 failing RoomManager tests were caused by the Phase 1-4 PR introducing `playerA`/`playerB` role assignment on rooms. The tests used `createRoom` directly (which doesn't assign roles) and then tried to deposit. The `handleDeposit` method checks `room.playerA`/`room.playerB` and bails early if null, preventing the transition to `playing`. Fixed by assigning roles after room creation in all affected tests.

**The Tech Debt:**

- [ ] **Event listener is observe-only** — it logs events but doesn't trigger any backend side-effects (e.g., auto-confirming deposits, updating room state). For production, `WagerDepositedEvent` should cross-reference with the `confirmDeposit` WebSocket message to verify on-chain deposit truth.
- [ ] **Manual MatchState parsing remains** — while we've corrected the offsets, the fundamental fragility persists. If the Web3 team adds another field before `token_mint`, offsets break again. Consider using `@coral-xyz/anchor` IDL-based deserialization for robustness.
- [ ] **Event listener reconnection** — if the WebSocket connection drops, `onLogs` does not auto-reconnect. Need a heartbeat/reconnect wrapper for production reliability.
- [ ] **`prevents self-matching` test** — pre-existing timeout failure. The test chains two `queueMatch` calls for the same address, but the second call attaches to the first's promise. When `player2` pairs with the first, the second promise resolves to the same room — leaving `player3` with nobody to pair with and `p2Promise` never resolving.

## 2026-05-04 - Fix ServerPlayerMeta Missing Property in Private Room Creation

**The Change:**
- Added default `characterId: 'einstein'` to the `playerMeta` initialization inside `createPrivateRoom` in `apps/api/src/managers/RoomManager.ts`.

**The Reasoning:**
- **Vercel Build Failure:** The missing property caused a TypeScript compilation error (`TS2322`) during Vercel deployment. `ServerPlayerMeta` mandates `characterId`, but it was omitted. Local development (`bun run dev`) bypassed this as it skips type checking, hiding the error until deployment.

**The Tech Debt:**
- **Hardcoded Default Character:** Hardcoding `einstein` as a fallback ensures the build passes and the user has a valid character in memory, but ideally, the Blink endpoint `/match/private` should eventually accept a `characterId` parameter from the challenge creator to allow them to pick their character.

## 2026-05-04 - Full Smart Contract Wireup for Match Initialization

**The Change:**
- Refactored `apps/api/src/routes/actions.ts` to include `initialize_match` alongside `deposit_wager`.
- Updated `POST /api/actions/challenge` to identify if the caller is Player A.
- Used backend environment variable `SOLANA_PRIVATE_KEY` to attach `server_pubkey`.

**The Reasoning:**
- **Incomplete Flow:** Previously, the backend only supported providing a solitary `deposit_wager` instruction. This naturally led to the contract failing during on-chain settlement, as `MatchState` hadn't even been initialized on the Solana program (missing PDA execution).
- **Two Actions in One:** By detecting the first player, we merge both instructions, so that `MatchState` initialization happens atomically with the primary deposit.

**The Tech Debt:**
- **Wallet Public Key Reading:** Deriving the `server_pubkey` from `bs58` directly is mildly brittle if key formatting diverges (e.g. Ed25519 length mismatch).
- **Error Handling for Token Mint:** Using a fallback `tokenMint` or `wagerAmount` on the public matchmaking queue is functional but depends on client honesty; this might need stricter server-side session syncing or an explicit config for the public queue.


---

## Entry 2026-05-04: Native SOL Wagering & Settlement Hardening

### The Change

**Backend & Settlement (4 files):**
- `apps/api/src/routes/actions.ts` — Injected `createAssociatedTokenAccountIdempotentInstruction` and `createSyncNativeInstruction` into the deposit transaction builder for wSOL auto-wrapping.
- `apps/api/src/utils/settlement.ts` — Added `createAssociatedTokenAccountIdempotentInstruction` to lazily create the treasury ATA before submitting `settle_match`.
- `apps/api/scratch/init-config.ts` — Executed to initialize the global `ProgramConfig` PDA on Devnet.
- `apps/api/.env` — Replaced the mistakenly committed `PROGRAM_ID` keypair with a dedicated operational backend server keypair.

### The Reasoning

1. **Native SOL UX**: The Solana Actions spec allows us to build complex transactions. By automatically injecting the wSOL wrap instructions in the initial transaction, users can wager native SOL without knowing wSOL exists. The backend still honors the smart contract's strict SPL token requirement.
2. **Treasury Resilience**: By prepending idempotent ATA creation to the settlement payload, we ensure that the backend settlement will never fail with an `AccountNotInitialized` error for the fee collection account.
3. **Sanitization Bug Fix**: The `invalid transaction: Transaction failed to sanitize accounts offsets correctly` error occurred because the backend was using the Program Keypair to sign the settlement, making the Program an invoked writable signer (which is illegal in legacy transactions). Rotating to a dedicated server keypair fixed this.

### The Tech Debt

- [ ] The backend operator wallet is currently paying the 0.002 SOL fee to create the treasury ATA if it doesn't exist. We should ensure the treasury ATAs are pre-funded in production.
- [ ] `init-config.ts` was run manually. This needs to be part of the production deployment scripts.

---

## 2026-05-05 - Blueprint V2: MagicBlock Ephemeral Rollup Backend Integration

### The Change

**New file:**
- `apps/api/src/services/magicblock.ts` — `MagicBlockService` class with 3 methods:
  - `createBattleSession()`: derives BattleSession PDA from `[b"battle", matchId]`, logs creation. Stub for actual `create_session` instruction + ER delegation (depends on `cora-battle` program deployment).
  - `registerCard()`: stub for `register_cards` instruction submission to ER.
  - `getSessionState()`: reads BattleSession account from ER RPC, parses the Anchor account binary layout (discriminator + 140 bytes) to extract `healthA`, `healthB`, `scoreA`, `scoreB`, `status`, and `winner`.

**Modified files:**
- `apps/api/package.json` — Added `@magicblock-labs/bolt-sdk` (v0.2.4) and `@magicblock-labs/ephemeral-rollups-sdk` (v0.13.0).
- `apps/api/.env` — Appended `MAGICBLOCK_RPC_URL`, `MAGICBLOCK_WS_URL`, `CORA_BATTLE_PROGRAM_ID` (all commented out by default).
- `apps/api/src/managers/RoomManager.ts` — 4 touch-points:
  1. Added `import { magicBlockService }` and re-exported `getServerKeypair` from settlement.
  2. Added `erSessionPda: string | null` to `Room` interface.
  3. Added `erSessionPda: null` to both `createRoom()` and `createPrivateRoom()`.
  4. `initializeEngine()` → made `async`, added ER session creation block gated by `process.env.MAGICBLOCK_RPC_URL`. Wrapped in try/catch — failure falls back silently to GameEngine-only.
  5. `broadcastMatchResult()` → made `async`, added ER winner verification before signing settlement. If ER reports a different winner, ER is source of truth.
- `apps/api/src/index.ts` — Added `GET /api/match/:roomId/proof` endpoint returning `{ erSessionPda, explorerUrl }` for fairness proof.

### The Reasoning

1. **Parallel Architecture:** The GameEngine remains the active game loop. ER runs alongside as a verifiable, on-chain mirror of game state. This design means zero regression risk — if ER is down or unconfigured, the system behaves exactly like V1.
2. **Opt-In Activation:** All MagicBlock env vars are commented out in `.env`. The backend only attempts ER interactions when `MAGICBLOCK_RPC_URL` is set. This allows the Web3 lead to deploy the `cora-battle` program independently and flip the switch without any further backend changes.
3. **ER as Source of Truth:** In `broadcastMatchResult`, when both GameEngine and ER report a winner, ER takes precedence. This establishes the on-chain game state as authoritative — critical for the "provably fair" narrative.
4. **Fairness Proof Endpoint:** The `/api/match/:roomId/proof` endpoint gives the frontend everything it needs to link to the Solana Explorer, enabling the "✅ Verified on-chain" badge.

### The Tech Debt

- [ ] **Stub instructions:** `createBattleSession` and `registerCard` are stubs — they derive PDAs but don't submit actual Anchor instructions. These need to be wired once the Web3 lead deploys `cora-battle` and provides the program ID.
- [ ] **Question hash:** `initializeEngine` passes a zeroed `questionHash` to `createBattleSession`. Should hash the actual question set for fairness proof.
- [ ] **Card registration:** Cards are not registered on ER during gameplay. The `registerCard` flow needs to be called for each card in the player's hand during `initializeEngine`.
- [ ] **`initializeEngine` is now async:** Callers (`handleDeposit`, `joinRoom`) call it without `await`. This is intentional (fire-and-forget for ER, engine starts synchronously), but unhandled rejections from the ER path should be monitored.
- [ ] **Manual BattleSession parsing:** `getSessionState` uses hardcoded byte offsets. If the Rust struct changes, parsing breaks silently (same pattern as `settlement.ts`).

## 2026-05-07 - GoldRush (Covalent) Integration & Wager USD Enrichment

### The Change
- **New Service:** Created `apps/api/src/services/goldrush.ts` initialized with `@covalenthq/client-sdk` pointing to `solana-devnet`. 
- **Playability & Pricing:** Implemented `getWalletPlayability`, `getTokenPriceUsd`, and `getWagerUsdValue` directly querying on-chain token balances and spot prices using Covalent's Balance and Pricing services.
- **Mocked History:** Implemented `getArenaHistory` and `getWalletHistory` to return safe, perfectly-typed mock `MatchHistoryItem[]` arrays instead of attempting to map raw Covalent transactions, protecting MVP scope.
- **API Routes:** Exposed the frontend data pipelines in `apps/api/src/index.ts` under `/api/history/arena/:arenaId`, `/api/history/wallet/:address`, and `/api/history/wallet/:address/playability`.
- **USD Broadcast:** Expanded `Room` and `GameState` types in `@shared/websocket` with a `wagerUsdValue` property. Upgraded `RoomManager` to perform non-blocking asynchronous USD enrichment inside `createPrivateRoom` and seamlessly push it out via `broadcastGameState`.

### The Reasoning
- **Data Protection:** The Covalent transaction APIs output very generic data (transfers, system calls). Rather than wrestling with filtering and parsing arbitrary logic to construct a `MatchHistoryItem`, falling back to mocked history ensures a safe and flawless frontend rendering experience for the MVP.
- **Non-Blocking Oracles:** Injecting USD prices at room creation asynchronously ensures `broadcastGameState` is not blocked, meaning real-time WebSocket speeds remain entirely uncompromised.
- **Seamless UI Ready:** Integrating the expected history endpoints using the exact frontend TypeScript contracts means zero downstream refactoring for the frontend team.

### The Tech Debt
- [ ] **History Indexing:** We are currently stubbing `/api/history/*`. Post-hackathon, we will need a dedicated Anchor event indexer (or equivalent) to scrape proper history instead of relying on the generic Covalent tx endpoints.
- [ ] **Public Matchmaking Wager Enrichment:** `wagerUsdValue` enrichment is currently only configured inside `createPrivateRoom`. The public queue `queueMatch` structure must also trigger the pricing oracle once a standard `tokenMint` fallback architecture is defined.

## 2026-05-08 — Fix GoldRush: Chain Target & Pricing Workaround

### The Change

**`apps/api/src/services/goldrush.ts` (3 fixes):**
1. **Chain target:** Changed `chainId` from `solana-devnet` to `solana-mainnet`. Covalent does not index Solana devnet — all API calls were returning `"Chain solana-devnet not supported."`.
2. **Symbol → mint resolver:** Added `TOKEN_MINTS` map (SOL, BONK, USDC) and `resolveMint()` helper so callers can pass either a symbol or a full mint address.
3. **Pricing workaround:** Replaced `PricingService.getTokenPrices()` with a `BalanceService.getTokenBalancesForWalletAddress()` probe against a known Solana Labs wallet. The SDK lowercases all addresses internally, corrupting Solana's case-sensitive base58 — breaking both the Pricing endpoint and the address-match logic in responses. The workaround reads the `quote_rate` field and matches by both case-insensitive address and ticker symbol fallback.

**`apps/api/test-goldrush.ts` (new):**
- Smoke-test script that calls `getTokenPriceUsd('SOL')` and `getWalletPlayability()` directly, runnable via `bun run test-goldrush.ts <wallet>`.

### The Reasoning

1. **Covalent has no devnet support.** This was the root cause of every GoldRush API call failing. Switching to `solana-mainnet` immediately fixed the BalanceService calls (`reliable: true`).
2. **SDK lowercases base58.** Both `PricingService.getTokenPrices()` and the raw REST endpoint lowercase the address in the URL path, causing Covalent to return `"Contract address not found!"`. The BalanceService workaround avoids this by querying balances (which work) and reading the embedded `quote_rate`.
3. **Native SOL mismatch.** Covalent returns native SOL under the system program address (`11111111111111111111111111111111`), not the wSOL mint. The ticker-symbol fallback (`contract_ticker_symbol === 'SOL'`) handles this transparently.

### The Tech Debt

- [ ] **SDK dependency is a liability.** The `@covalenthq/client-sdk` lowercases all Solana addresses, making it fundamentally broken for Solana. A future PR should replace it with direct REST `fetch` calls to preserve base58 casing and unlock the native Pricing endpoint for all tokens (SOL, BONK, USDC).
- [ ] **Probe wallet dependency.** The pricing workaround only returns prices for tokens held by the probe wallet (`vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg`). BONK and USDC return `null` because that wallet doesn't hold them. Switching to direct REST will fix this.
- [ ] **`test-goldrush.ts` is not in CI.** It's a manual smoke test. Should be moved to a proper test suite once testing infrastructure is set up.


## 2026-05-08 - Dynamic Supabase Match Questions

**The Change:**
- Added Supabase client to `apps/api/src/questions.ts`.
- Implemented `fetchMatchQuestions()` executing the Supabase RPC `get_distributed_questions`.
- Added mapping logic for `question_text` (snake_case from Postgres) to `questionText` (camelCase) to pass strict `@shared/question` validation.
- Updated `apps/api/src/managers/room/Engine.ts` to asynchronously fetch a unique chunk of questions (`await fetchMatchQuestions()`) on match initialization.
- Built a high-availability fallback mechanism to serve questions from `data/questions/pool.json` automatically if the database call fails, errors, or returns 0 records.
- Generated DB seed and test scripts inside `apps/api/scratch/` for streamlined local development.

**The Reasoning:**
- **Dynamic Scaling:** Previously, loading a single `pool.json` at server boot meant all matches shared the same static question pool unless the server was restarted. Pulling per-match via Supabase allows for dynamic question balancing, limitless pool scaling, and eliminates stale questions.
- **Zero Downtime Fallback:** As a live multiplayer game, losing the DB connection shouldn't crash active or starting matches. The local JSON fallback ensures the game server is highly resilient.
- **Strict Data Contracts:** Explicitly mapping the payload to camelCase prevented catastrophic validation failures downstream in the unified `GameEngine`.

**The Tech Debt:**
- **Network Overhead:** We are now making an external database call *every* time a match starts. If matchmaking volume spikes significantly, this could become a bottleneck.
- **Cache Invalidation:** We might need to implement a Redis or local memory cache with a TTL (Time-To-Live) later to reduce DB load while maintaining question freshness.

## 2026-05-08 - Bag Shuffle Algorithm & Question Provider Refactor (SSOT)

**The Change:**

* Replaced the Postgres RPC `get_distributed_questions` with a "Fat Fetch" `get_match_deck` function that pulls exactly 60 distinct questions (20 Math, 20 Logical, 20 Sequence).
* Implemented the "Bag Shuffle" algorithm inside `apps/api/src/questions.ts`. It groups the 60 questions into mini-batches of 3 (containing 1 of each category), shuffles them internally, and constructs the final master deck.
* Refactored the `GET /api/questions` route in `apps/api/src/index.ts` to strip out duplicated database logic and point directly to `fetchMatchQuestions()`.
* Established `questions.ts` as the definitive Single Source of Truth (SSOT) for all question fetching, formatting, and shuffling across both REST and WebSocket channels.

**The Reasoning:**

* **Preventing Deck Exhaustion:** A fast-paced 5-minute match with 10-second card timeouts can easily burn through the previous 10-card limit. Supplying a 60-card master deck mathematically guarantees a player will never run out of questions, preventing engine crashes or undefined states.
* **Guaranteed Hand Diversity:** Pure SQL `ORDER BY RANDOM()` causes "clumping" (e.g., drawing 4 Math cards in a row). The Bag Shuffle system dictates the distribution sequence. Because it feeds the deck in micro-shuffled batches of `[Math, Logical, Sequence]`, it is impossible for a player drawing a 5-card hand to hold more than 2 cards of the exact same category.
* **Architectural Cleanliness:** Removing the duplicate database query from `index.ts` prevents drift. If we change the question schema or shuffle logic later, we only update `questions.ts` and it automatically propagates to both the API and the GameEngine.

**The Tech Debt:**

* **Over-Fetching:** We are now querying and transferring 60 full question objects (with all nested options and explanations) from Supabase to the Bun server on every match initialization. In reality, most matches will end before 15 cards are played, meaning 75% of the fetched data is wasted bandwidth.
* **Server Memory Footprint:** Holding a 60-card deck in memory for every active `Room` instance increases the memory overhead per match. If concurrent active matches scale significantly, this could put pressure on the Node/Bun garbage collector.


## 2026-05-08 - Backend Contract Deduplication Refactor

**The Change:**
- Added `apps/api/src/config/solana.ts` as the backend source of truth for the CORA escrow program ID, Anchor instruction discriminators, and manual `MatchState` byte offsets.
- Added `apps/api/src/config/tokens.ts` as the source of truth for devnet/mainnet token mint maps and token symbol resolution.
- Refactored Blink transaction building, Solana settlement, event listening, private match creation, and GoldRush pricing to use the shared config modules instead of duplicating constants.
- Split final game outcome from settlement authorization: `matchResult` now carries only the gameplay result, while `settlementAuthorization` carries the signed settlement payload.
- Tightened WebSocket/message typing by changing `WsMessage` payloads from `any` to `unknown`, adding payload readers in `RoomManager`, and replacing Bun-specific room socket typing with a minimal `RoomSocket` interface compatible with Hono's `WSContext`.
- Removed the dead commented `/api/questions` implementation and unused imports from the backend source.

**The Reasoning:**
- The previous backend had several quiet sources of drift: token mint maps existed in three places, the program ID and instruction/layout details existed in multiple Web3 modules, and `matchResult` represented two different event contracts.
- The new config files keep cluster-specific token differences explicit, especially the devnet/mainnet USDC split needed by Blink transactions versus GoldRush pricing.
- Separating `settlementAuthorization` from `matchResult` prevents clients from receiving two semantically different "final result" payloads under the same event name.
- The minimal socket interface keeps room management independent from Bun internals while still supporting both native Bun sockets and Hono WebSocket contexts.

**The Tech Debt:**
- `bun test` now runs outside the sandbox, but `RoomManager.test.ts` still has 7 failures around message ordering and synchronous assumptions for async `initializeEngine()`; source typecheck and backend source lint pass.
- MagicBlock remains stubbed and still has TODO comments around actual ER instruction submission.
- `tsconfig.tsbuildinfo` is modified by local typecheck runs because the API tsconfig uses `composite`; consider excluding it from source control or using a no-buildinfo verification command.

## 2026-05-08 - WebSocket Settlement Event Split

**The Change:**
- Updated `apps/web/src/hooks/useMatchSocket.ts` to listen for the backend's new `settlementAuthorization` WebSocket event.
- Kept a backward-compatible fallback for older `matchResult` settlement payloads while treating the current `matchResult` event as the gameplay summary.
- Updated `packages/shared-types/src/websocket.ts` so `ClientToServerEvents` matches the object payloads the frontend already sends for `playCard` and `confirmDeposit`.

**The Reasoning:**
- The backend now separates the game result from the signed settlement authorization to avoid two incompatible payloads sharing the `matchResult` event name.
- The battle UI already had separate state for match summary and settlement details, so the frontend only needed the socket hook to route the new event into the existing `settlementResult` state.
- Aligning the shared client-to-server event types removes another small contract drift between FE and BE.


## 2026-05-09 - MagicBlock ER Authority: Room State & Backend Setup Pipeline (Points 1 & 2)

### The Change

**`apps/api/src/managers/room/types.ts` (3 new types, 4 new Room fields):**
- Added `ErRegisteredCard` interface tracking per-card ER state: `cardPda`, `owner`, `effectType`, `maxValue`, `isDelegated`, `isConsumed`.
- Added `ErLifecycleStatus` type — a 9-state FSM (`none` → `creating` → `registering` → `activating` → `delegating` → `active` → `committing` → `finished` | `failed`) so the backend can branch on exactly where the ER setup is.
- Added `ErProofMeta` interface for the `/proof` API endpoint: stores session PDA, setup tx signatures, terminal tx signatures, and end reason.
- Extended `Room` with `erEnabled`, `erLifecycleStatus`, `erCardRegistry: Map<string, ErRegisteredCard>`, and `erProofMeta`.

**`apps/api/src/managers/room/Store.ts` (ER defaults):**
- `erEnabled` defaults from `isMagicBlockConfigured()` at room creation — all room code branches on `room.erEnabled` instead of re-checking the env every time.
- Other ER fields default to `'none'`, empty `Map`, and `null`.

**`apps/api/src/utils/questionHash.ts` (NEW):**
- `deriveQuestionHash()` — SHA-256 of sorted question IDs, producing the deterministic 32-byte hash needed by `createSession`. Replaces the zeroed `new Uint8Array(32)` placeholder.

**`packages/game-logic/src/QuestionDealer.ts` (question accessor):**
- Stores `allQuestions` at construction time (before pools are consumed by dealing).
- Added `getQuestions()` accessor returning the original full set.

**`packages/game-logic/src/GameEngine.ts` (question accessor):**
- Added `getQuestions()` delegating to `QuestionDealer.getQuestions()` so `Blockchain.createBattleSession()` can derive the question hash.

**`apps/api/src/managers/room/Blockchain.ts` (full ER setup pipeline):**
- Refactored `createBattleSession()` from a 2-step stub (createSession + delegate) into a **5-phase pipeline**:
  1. `createSession` with real `questionHash` (base RPC)
  2. `registerCardV2` × 10 — initial visible hand (5 cards × 2 players) with deterministic card keys `<playerIndex>-<slotIndex>` (base RPC)
  3. `activateSession` (base RPC)
  4. `delegateBattleSession` (router RPC)
  5. `delegateRegisteredCard` × 10 (router RPC)
- Card key encoding: `"0-00"` through `"1-04"` — always ≤5 bytes UTF-8, well within the 16-byte on-chain limit.
- On any phase failure, `erEnabled` flips to `false`, `erLifecycleStatus = 'failed'`, match continues engine-only.
- All tx signatures are collected in `setupTxs` and stored in `room.erProofMeta`.

**`apps/api/src/routes/match.ts` (enhanced /proof endpoint):**
- `GET /api/match/:roomId/proof` now returns `erEnabled`, `status` (lifecycle phase), `setupTxSignatures`, `terminalTxSignatures`, and `endReason` alongside the existing `erSessionPda` and `explorerUrl`.

### The Reasoning

1. **`erEnabled` at creation time:** Previously, every ER-aware code path had to call `isMagicBlockConfigured()`. Caching the result on the room at creation time means all subsequent branching is a simple boolean check — cleaner, faster, and prevents inconsistency if env vars are modified mid-flight.
2. **Fine-grained lifecycle FSM:** The 9-state `ErLifecycleStatus` lets us log exactly which phase failed, retry from the correct point if needed (future), and gives the `/proof` endpoint meaningful status for the frontend fairness badge.
3. **Deterministic card keys:** Engine card IDs are long UUIDs (`card-<questionId>-<timestamp>-<random>`) that exceed the 16-byte on-chain limit. The `<playerIndex>-<slotIndex>` encoding is short, deterministic, and unique per session — ideal for PDA derivation.
4. **Question hash from IDs only:** SHA-256 of sorted question IDs is sufficient to prove the question set is deterministic and unchanged. Including full text would be wasteful and leak question content on-chain.
5. **Lazy registration:** Only the initial 10 visible hand cards are registered. Replacement cards (after a play consumes one) will be registered lazily in Point 4's `handlePlayCard` refactor — this keeps room start latency reasonable.

### The Tech Debt

- [ ] **Replacement card registration:** Point 4 (not yet implemented) must register and delegate new cards before they become playable when a hand slot is refilled.
- [ ] **ER terminal flow:** Points 4–5 (commit/undelegate/read final state/settle from ER) are not yet wired.
- [ ] **Surrender rejection:** ER rooms should reject surrender at the websocket layer — to be implemented in Point 4.
- [ ] **Pre-existing test failures:** The same 7 `RoomManager.test.ts` failures around message ordering and async `initializeEngine()` persist — they predate this change and are documented in the 2026-05-08 Backend Contract Deduplication entry.
- [ ] **`allQuestions` memory:** `QuestionDealer` now stores a copy of all valid questions for the match lifetime. This is ~60 question objects per match — negligible, but worth noting.

## 2026-05-10 - Blink Matchmaking Soft Commitment Backend

### The Change
- Added `apps/api/src/services/blinkMatches.ts` with a Supabase-backed Blink match repository and in-memory fallback for local/no-env testing.
- Reworked private Blink creation so `/match/private` creates a `PENDING` DB challenge instead of an in-memory depositing room.
- Replaced targeted `/api/actions/challenge?roomId=...` handling with the soft-commitment flow:
  - Player A/creator creates the challenge without paying.
  - Player B/challenger accepts first and receives an `initialize_match + deposit_wager` transaction.
  - Player A later receives a `deposit_wager` transaction and starts the game after websocket `confirmDeposit`.
- Added private room hydration from Supabase when `/match/:roomId` is opened for a `CHALLENGED` Blink match.
- Added a Blink janitor in `RoomManager` to mark `PENDING -> EXPIRED` and `CHALLENGED -> FORFEITED`.
- Added `apps/api/supabase/matches.sql`, `apps/api/test/blinkMatches.test.ts`, and the smoke script `bun run test:blink-soft`.

### The Reasoning
- The current escrow program requires `player_b` at `initialize_match`, so the backend cannot implement true Player-A-pays-first Blinks yet.
- The workaround preserves the user-facing creator/challenger roles while using Player B as the on-chain initializer for now.
- Keeping this path in a separate Blink match repository avoids touching the working public FIFO matchmaking queue.

### The Tech Debt
- True Player-A-pays-first Blink challenges require smart contract support for open challenges where `player_b` is assigned later.
- During `PENDING`, Player A has no funds at risk; if Player A flakes after Player B accepts, Player B can only reclaim/refund their own deposit with today's contract.
- Current on-chain timeout constants may not align with the backend's 15-minute accept window and 3-minute creator response window.
- Full `bun test` and `bun run lint` still hit pre-existing repo harness/lint issues; focused Blink tests and API typecheck pass.

## 2026-05-10 - Blink True Flow Backend Cutover (Soft → True Commitment)

### The Change

**`apps/api/src/config/solana.ts` (discriminators):**
- Added `createOpenChallenge`, `acceptChallenge`, `reclaimChallenge` discriminators from the deployed IDL (Entry 26 in DEVLOG-WEB3). These are required by the new transaction builders.

**`apps/api/src/services/BlinkTransactionBuilder.ts` (2 new methods):**
- Added `buildCreateOpenChallengeTransaction(account, matchIdBytes, tokenMint, wagerAmount)`:
  - Derives `challenge_state` and `challenge_vault` PDAs from `CHALLENGE_SEED` / `CHALLENGE_VAULT_SEED` + match_id.
  - Creator is signer/funder. Includes wSOL wrap for native SOL.
  - Returns unsigned base64 serialized transaction.
- Added `buildAcceptChallengeTransaction(account, matchIdBytes, tokenMint, creatorPubkey)`:
  - Derives both challenge PDAs (closed by accept_challenge) and final escrow PDAs (created by accept_challenge).
  - `creatorPubkey` is read from the DB row (`creator_wallet`) at the time challenger hits `POST /api/actions/challenge`.
  - Challenger is signer. Creator receives rent from closed challenge accounts.
  - Returns unsigned base64 serialized transaction.
- Kept existing `buildDepositTransaction` for public FIFO matchmaking (untouched).

**`apps/api/src/routes/match.ts` (Change 1 — creator flow):**
- `POST /match/private` no longer writes a DB row immediately. Instead:
  1. Generates `roomId` (UUID) and derives `matchIdBytes`.
  2. Builds unsigned `create_open_challenge` transaction.
  3. Returns `{ roomId, blinkUrl, transaction }`.
- `POST /match/private/confirm` (NEW endpoint):
  - Accepts `{ roomId, address, signature, tokenMint, wagerAmount }`.
  - Verifies on-chain confirmation with `connection.confirmTransaction(sig, 'confirmed')` and 30s timeout.
  - On success: writes DB row via `blinkMatches.createPending()` with the pre-determined `roomId`. Returns `{ status: 'PENDING' }`.
  - On timeout: returns **408 Request Timeout**, does NOT write DB row.
  - On tx failure: returns 400 with error message.

**`apps/api/src/routes/actions.ts` (Change 2 — challenger flow):**
- PENDING path now builds `accept_challenge` transaction (was `initialize_match + deposit_wager`).
- Removed CHALLENGED creator deposit path entirely — after `accept_challenge`, both wagers are locked on-chain. Creator only needs to join WebSocket.
- Non-PENDING requests return 409 with "Challenge already accepted. Join the match via WebSocket."

**`apps/api/src/managers/RoomManager.ts` (Change 3 — FORFEITED settlement + hydration):**
- `createPrivateRoom()` returns `{ roomId, transaction }` instead of just `roomId`.
- `confirmPrivateRoom()` (NEW) verifies on-chain, then writes DB with pre-determined ID.
- Janitor `runBlinkJanitorOnce()`: FORFEITED matches now trigger `submitSettlementTransaction(action=0, target=challengerWallet)`.
  - On success: marks DB `COMPLETED`.
  - On failure: keeps DB as `FORFEITED`, logs `match_id` and `challenger_wallet` explicitly. **Never silently swallows.**
- `hydrateBlinkRoomInternal()`: both players now marked `hasDeposited: true` (was `false` for creator in soft flow).

**`apps/api/src/managers/room/Lifecycle.ts` (Change 3 — deadline settlement):**
- Creator deadline miss now also triggers `submitSettlementTransaction(action=0, target=challengerWallet)` with same success/failure handling as janitor.

**`apps/api/src/services/blinkMatches.ts` (timeout alignment):**
- `JOIN_WINDOW_MS` changed from `3 * 60 * 1000` (180s) to `ESCROW_CONSTANTS.DEPOSIT_TIMEOUT_SECONDS * 1000` (30s) — matches on-chain timeout.
- `PENDING_TTL_MS` changed from hardcoded `15 * 60 * 1000` to `ESCROW_CONSTANTS.CHALLENGE_EXPIRY_SECONDS * 1000` (900s).
- `CreateBlinkMatchInput` now accepts optional `id` for pre-determined PDA derivation.

**`apps/api/test/blinkMatches.test.ts` (3 new tests):**
- Pre-determined ID support: verifies `createPending({ id: 'custom-id' })` uses the given ID.
- 30s window boundary: verifies `joinDeadline` is ~30s from acceptance.
- Creator self-accept rejection: verifies `acceptPending(id, CREATOR)` returns `creator_cannot_accept`.

### The Reasoning

1. **True on-chain commitment:** The soft flow was a workaround because the contract couldn't accept a creator-pays-first model. Now that `create_open_challenge` and `accept_challenge` are deployed (DEVLOG-WEB3 Entry 26), we can implement the intended flow where Player A funds the escrow *before* sharing the Blink link.
2. **Two-step creation:** `POST /match/private` returns the unsigned tx; `POST /match/private/confirm` verifies on-chain before writing DB. This avoids blocking the HTTP connection and prevents orphaned DB rows if the creator never signs.
3. **FORFEITED settlement on-chain:** Previously, a FORFEITED match only cancelled the room locally. Now the janitor and lifecycle both trigger `settle_match(action=0, target=challenger)`, ensuring the challenger receives the escrowed wagers automatically. Failure handling is explicit — DB stays `FORFEITED` with loud logging.
4. **Timeout alignment (180s → 30s):** The smart contract's `DEPOSIT_TIMEOUT_SECONDS = 30` was mismatched with the backend's 3-minute join window. Corrected to import from `@shared/escrow` to prevent future drift.
5. **Both players deposited:** After `accept_challenge`, both wagers are locked on-chain. The room hydration now reflects this — creator only needs to join via WebSocket, not sign another transaction.

### The Tech Debt

- [ ] **confirmTransaction timeout:** `connection.confirmTransaction` uses the default timeout (~30s). For production, consider using `confirmTransaction` with `lastValidBlockHeight` for more reliable timeout behavior.
- [ ] **Pre-existing test failures:** 8 `RoomManager.test.ts` failures remain (engine is null due to missing questions API in test environment). These predate this change.
- [ ] **Reclaim challenge:** The `reclaim_challenge` instruction is supported by the contract but not yet wired in the backend. If a creator's challenge expires on-chain before anyone accepts, the creator can reclaim via a frontend-only flow.

## 2026-05-11 - Fix: Preserve hasDeposited on WebSocket Join

### The Change
- Fixed `joinRoom` in `Lifecycle.ts` to preserve `hasDeposited: true`
  when a player joins a hydrated private Blink room.
- Previously, `hydrateBlinkRoomInternal` correctly set both players to
  `hasDeposited: true` after `accept_challenge`, but `joinRoom` overwrote
  it back to `false` on new connections.
- Both players now enter `playing` state automatically when both connect
  to a hydrated room, without needing to send `confirmDeposit`.

### The Reasoning
- After `accept_challenge`, both wagers are locked on-chain. The WebSocket
  join is presence confirmation only, not a deposit gate. The metadata
  must reflect the on-chain reality.
- The FE had a workaround (resending deposit signature via `confirmDeposit`
  after join). That workaround can remain as a harmless safety net but the
  root cause is now fixed on the backend.

## 2026-05-11 - Blink URL Browser Redirect

### The Change
- Added browser detection to `GET /api/actions/challenge` via `Accept`
  header content negotiation.
- Normal browser requests (Accept: text/html) with a `roomId` now
  redirect to `FE_BASE_URL/challenge/:roomId` (302).
- Blink-compatible wallets (Accept: application/json) continue to
  receive the JSON action payload unchanged.
- Added `FE_BASE_URL` env var (default: `http://localhost:3000`).

### The Reasoning
- Sharing the raw Blink URL outside a wallet-aware app returned raw JSON,
  making the link unusable for anyone without a Blink-compatible client.
- Content negotiation is the standard Solana Actions pattern for this —
  wallets send application/json, browsers send text/html.
- Terminal states (EXPIRED, FORFEITED) correctly redirect to FE which
  already handles the "Challenge Closed" UI via status polling.

### The Tech Debt
- [ ] The generic Blink endpoint (no roomId) does not redirect browsers.
  If a creator shares the base Blink URL without a roomId, a browser
  visitor still sees JSON. Low priority — the shareable link always
  includes a roomId.

## 2026-05-22 - Queue Match Persistence + Unified Match History

### The Change
- Added `apps/api/supabase/queue_matches.sql` to persist public queue matches in Supabase.
- Added `apps/api/supabase/match_records_view.sql` as a unified `public.match_records` view over public queue matches and existing Blink matches.
- Added `apps/api/src/services/queueMatches.ts`, a queue match store with Supabase persistence and memory fallback for local/test environments.
- Exported a reusable Supabase client from `apps/api/src/services/supabase.ts` for read routes.
- Added `apps/api/src/routes/matches.ts` and mounted it in `apps/api/src/index.ts` at `/api/matches`.
  - `GET /api/matches/history/:wallet`
  - `GET /api/matches/record/:source/:id`
- Refactored `apps/api/src/managers/room/Queue.ts` so public queue matches create the DB row before creating the in-memory room or removing the waiting opponent.
- Made `/queue` WebSocket matchmaking async in `apps/api/src/routes/queueSocket.ts` and added failure handling for persistence errors.
- Added `queueMatches` to `RoomManager` beside `blinkMatches`.
- Added `depositSignature?: string` and `queueMatchPersisted?: boolean` to room/player metadata in `apps/api/src/managers/room/types.ts`.
- Updated `apps/api/src/managers/room/Lifecycle.ts` to persist public queue lifecycle transitions:
  - both deposits confirmed -> `ACTIVE`
  - no-deposit timeout or explicit cancel -> `CANCELLED`
  - one deposited player and one timeout -> `FORFEITED`
  - zombie janitor cleanup -> `ABANDONED`
- Updated `apps/api/src/managers/room/Blockchain.ts` so queue matches are marked `COMPLETED` only after settlement succeeds, and `SETTLEMENT_FAILED` when settlement fails.
- Updated `apps/api/src/managers/room/Engine.ts` and surrender paths to handle the new `SettlementResult`.
- Updated `apps/api/src/managers/room/Store.ts` and `apps/api/test/RoomManager.test.ts` so unit tests can disable ER deterministically while production still follows MagicBlock configuration.

### The Reasoning
1. **Public queue matches needed durable state.** Previously, queue matches lived only in memory. A Railway restart, deploy, or room cleanup could erase the match history even if players had deposited or completed a game.
2. **DB creation must be part of matchmaking, not analytics.** The queue now writes `queue_matches` before creating the in-memory room. If Supabase creation fails, the waiting opponent is not removed and no public room is created.
3. **`match_records` avoids breaking legacy history.** Existing `/api/history` remains unchanged, while new `/api/matches/*` routes can read a normalized history surface for queue and Blink records.
4. **Settlement success is the completion boundary.** Public queue matches only become `COMPLETED` after `submitSettlementTransaction()` succeeds. Failed settlement is now observable as `SETTLEMENT_FAILED` with an error string instead of silently looking complete.
5. **Persist only real queue rooms.** Some tests and internal flows create `roomType: public` rooms directly. The `queueMatchPersisted` flag prevents those synthetic/manual rooms from writing noisy or invalid `queue_matches` updates.
6. **Blink v1 remains deliberately conservative.** The unified history view exposes Blink rows, but leaves Blink `winner` and `settled_at` as `null` because the existing `public.matches` table does not store those fields yet.

### The Tech Debt
- [ ] **Run Supabase SQL in deployment:** `queue_matches.sql` and `match_records_view.sql` must be applied manually or through the migration process before Railway can persist/read queue history.
- [ ] **Full test suite still has unrelated failures:** Focused checks pass, but `bun test` still fails because integration tests cannot connect to `localhost:9876` and `data/questions/questions.json` is missing in this workspace.
- [ ] **Blink history remains partial:** `match_records` currently cannot expose Blink `winner` or `settled_at` until `public.matches` stores those fields.
- [ ] **Deposit confirmation is still client-triggered:** Queue match rows store deposit signatures, but backend still relies on `confirmDeposit` messages. Production should verify deposit signatures against Solana RPC before marking deposits trusted.
- [ ] **Memory fallback is not durable:** The queue store falls back to memory when Supabase env vars are missing. That is useful for local tests but should not be treated as production persistence.
