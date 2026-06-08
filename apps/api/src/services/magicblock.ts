import { existsSync, readFileSync } from 'fs';
import { PublicKey, Keypair, Connection, SystemProgram, Transaction, type Signer } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, type Idl } from '@coral-xyz/anchor';
import { deriveMatchId } from '@shared/escrow';

type AddressLike = PublicKey | string;
type FixedBytes = Uint8Array | number[];
type RpcLane = 'base' | 'router';
type MagicRouterBlockhash = { blockhash: string; lastValidBlockHeight: number };

const DEFAULT_BASE_RPC_URL = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const ROUTER_RPC_URL =
  process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
  process.env.MAGICBLOCK_ROUTER_RPC_URL ||
  process.env.MAGICBLOCK_RPC_URL;
const ROUTER_WS_URL =
  process.env.EPHEMERAL_WS_ENDPOINT ||
  process.env.MAGICBLOCK_ROUTER_WS_URL ||
  process.env.MAGICBLOCK_WS_URL;
const BATTLE_SEED = Buffer.from('battle');
const CARD_SEED = Buffer.from('card');
const DEFAULT_BATTLE_PROGRAM_ID = 'Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic';
const CORA_BATTLE_IDL = loadCoraBattleIdl();
const BATTLE_PROGRAM_ID = new PublicKey(
  process.env.CORA_BATTLE_PROGRAM_ID || CORA_BATTLE_IDL.address || DEFAULT_BATTLE_PROGRAM_ID,
);
const battleIdl: Idl = {
  ...CORA_BATTLE_IDL,
  address: BATTLE_PROGRAM_ID.toBase58(),
};

// Keep these aligned with the on-chain account sizes in state.rs.
// v5 inline-manifest layout: 267 (old) + 1+1+16+16+1+1+384+384 = 1071
const BATTLE_SESSION_ACCOUNT_SPACE = 1071;
const REGISTERED_CARD_ACCOUNT_SPACE = 95;

let baseConnection: Connection | null = null;
let routerConnection: Connection | null = null;
let routerSupportsAccountScopedBlockhash: boolean | null = null;
let routerEndpointLogged = false;

/**
 * These constants must stay in lockstep with
 * packages/contracts/solana/cora-battle/programs/cora-battle/src/constants.rs.
 */
export const EFFECT_ATTACK = 1;
export const EFFECT_HEAL = 2;
export const EFFECT_NONE = 3;

export const END_REASON_NONE = 0;
export const END_REASON_NORMAL_WIN = 1;
export const END_REASON_SINGLE_PLAYER_TIMEOUT = 2;
export const END_REASON_BOTH_PLAYERS_TIMEOUT = 3;
export const END_REASON_SERVER_CANCELLED = 4;
export const END_REASON_CHEATER_FLAGGED = 5;
export const END_REASON_FORCE_ENDED = 6;
export const END_REASON_DRAW_NO_CONTEST = 7;
export const END_REASON_SURRENDER = 8;

export const MAGICBLOCK_END_REASONS = {
  NONE: END_REASON_NONE,
  NORMAL_WIN: END_REASON_NORMAL_WIN,
  SINGLE_PLAYER_TIMEOUT: END_REASON_SINGLE_PLAYER_TIMEOUT,
  BOTH_PLAYERS_TIMEOUT: END_REASON_BOTH_PLAYERS_TIMEOUT,
  SERVER_CANCELLED: END_REASON_SERVER_CANCELLED,
  CHEATER_FLAGGED: END_REASON_CHEATER_FLAGGED,
  FORCE_ENDED: END_REASON_FORCE_ENDED,
  DRAW_NO_CONTEST: END_REASON_DRAW_NO_CONTEST,
  SURRENDER: END_REASON_SURRENDER,
} as const;

export const MAGICBLOCK_EFFECT_TYPES = {
  ATTACK: EFFECT_ATTACK,
  HEAL: EFFECT_HEAL,
  NONE: EFFECT_NONE,
} as const;

export type BattleSessionStatus = 'WaitingCards' | 'Active' | 'Finished' | 'Cancelled';

export interface BattleSessionState {
  sessionPda: string;
  authority: string;
  playerA: string;
  playerB: string;
  status: BattleSessionStatus;
  healthA: number;
  healthB: number;
  // Canonical round wins mirrored from score_a / score_b on-chain.
  scoreA: number;
  scoreB: number;
  // Match-level gameplay score used as the final winner tie-break after round wins.
  gameScoreA: number;
  gameScoreB: number;
  // Current-round offensive contribution, used for normal time-up resolution.
  roundDamageA: number;
  roundDamageB: number;
  currentRound: number;
  roundStartedAt: number;
  roundDeadline: number;
  winner: string | null;
  endReason: number;
  finishedAt: number;
  totalPlays: number;
  // Inline manifest fields (v5)
  totalSlotsA: number;
  totalSlotsB: number;
  manifestCommittedA: boolean;
  manifestCommittedB: boolean;
}

interface CreateSessionParams {
  roomId: string;
  playerA: AddressLike;
  playerB: AddressLike;
  questionHash: FixedBytes;
  serverKeypair: Keypair;
  matchId?: FixedBytes;
}

interface LegacyCreateBattleSessionParams {
  matchId: FixedBytes;
  playerA: AddressLike;
  playerB: AddressLike;
  questionHash: FixedBytes;
  serverKeypair: Keypair;
  roomId?: string;
}

interface SessionInstructionParams {
  roomId?: string;
  sessionPda: AddressLike;
  serverKeypair: Keypair;
}

interface SessionCardInstructionParams extends SessionInstructionParams {
  cardPda: AddressLike;
}

interface RegisterCardParams extends SessionInstructionParams {
  cardId: string | Uint8Array;
  damage: number;
}

interface RegisterCardV2Params extends SessionInstructionParams {
  owner: AddressLike;
  cardId: string | Uint8Array;
  effectType: number;
  maxValue: number;
}

interface DelegateRegisteredCardParams extends SessionCardInstructionParams {
  cardId?: string | Uint8Array;
}

interface ApplyDamageParams extends SessionCardInstructionParams {
  attacker: AddressLike;
}

interface ApplyCardEffectParams extends SessionCardInstructionParams {
  finalValue: number;
  scoreDelta: number;
}

interface SetCardManifestParams extends SessionInstructionParams {
  isPlayerA: boolean;
  totalSlots: number;
  manifest: Uint8Array;  // packed [effectType, maxValueLo, maxValueHi] × totalSlots
}

interface ApplyEffectParams extends SessionInstructionParams {
  slot: number;
  actorIsA: boolean;
  finalValue: number;
  scoreDelta: number;
}

interface SurrenderMatchParams extends SessionInstructionParams {
  surrenderingPlayer: AddressLike;
}

interface TimeoutPlayerForRoundParams extends SessionInstructionParams {
  timedOutPlayer: AddressLike;
}

interface CancelSessionParams extends SessionInstructionParams {
  reason: number;
}

function getOptionalValidatorRemainingAccounts():
  | Array<{ pubkey: PublicKey; isSigner: false; isWritable: false }>
  | undefined {
  const validatorIdentity =
    process.env.MAGICBLOCK_VALIDATOR_IDENTITY ||
    process.env.MAGICBLOCK_LOCAL_VALIDATOR_IDENTITY;
  if (!validatorIdentity) return undefined;
  return [
    {
      pubkey: new PublicKey(validatorIdentity),
      isSigner: false,
      isWritable: false,
    },
  ];
}

function loadCoraBattleIdl(): Idl {
  const candidateUrls = [
    new URL('../../../../packages/solana-client/src/cora_battle.json', import.meta.url),
    new URL('../../../../packages/contracts/solana/cora-battle/target/idl/cora_battle.json', import.meta.url),
  ];

  for (const candidate of candidateUrls) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as Idl;
    }
  }

  throw new Error('Could not locate cora_battle IDL. Expected packages/solana-client or battle target output.');
}

export function isMagicBlockConfigured(): boolean {
  return Boolean(ROUTER_RPC_URL);
}

export async function getBaseLamportBalance(address: AddressLike): Promise<number> {
  return getBaseConnection().getBalance(toPublicKey(address), 'confirmed');
}

export async function estimateErSetupRentLamports(registeredCardCount: number): Promise<{
  sessionRentLamports: number;
  cardRentLamports: number;
  totalRentLamports: number;
}> {
  const connection = getBaseConnection();
  const [sessionRentLamports, cardRentLamports] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(BATTLE_SESSION_ACCOUNT_SPACE),
    connection.getMinimumBalanceForRentExemption(REGISTERED_CARD_ACCOUNT_SPACE),
  ]);
  return {
    sessionRentLamports,
    cardRentLamports,
    totalRentLamports: sessionRentLamports + cardRentLamports * registeredCardCount,
  };
}

export function deriveBattleSessionPdaFromMatchId(matchId: FixedBytes): PublicKey {
  return PublicKey.findProgramAddressSync(
    [BATTLE_SEED, Buffer.from(normalizeFixedBytes(matchId, 32, 'matchId'))],
    BATTLE_PROGRAM_ID,
  )[0];
}

export function deriveBattleSessionPdaFromRoomId(roomId: string): PublicKey {
  return deriveBattleSessionPdaFromMatchId(deriveMatchId(roomId));
}

export function deriveRegisteredCardPda(sessionPda: AddressLike, cardId: string | Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CARD_SEED, toPublicKey(sessionPda).toBuffer(), Buffer.from(normalizeCardId(cardId))],
    BATTLE_PROGRAM_ID,
  )[0];
}

function getBaseConnection(): Connection {
  if (!baseConnection) {
    baseConnection = new Connection(DEFAULT_BASE_RPC_URL, 'confirmed');
  }
  return baseConnection;
}

function getRouterConnection(): Connection {
  if (!ROUTER_RPC_URL) {
    throw new Error(
      'MagicBlock Router RPC is not configured. Set MAGICBLOCK_ROUTER_RPC_URL or EPHEMERAL_PROVIDER_ENDPOINT.',
    );
  }
  if (!routerConnection) {
    routerConnection = new Connection(ROUTER_RPC_URL, {
      commitment: 'confirmed',
      wsEndpoint: ROUTER_WS_URL,
    });
  }
  if (!routerEndpointLogged) {
    routerEndpointLogged = true;
    console.log('[MagicBlock] Using router endpoint', {
      rpc: ROUTER_RPC_URL,
      ws: ROUTER_WS_URL ?? null,
    });
  }
  return routerConnection;
}

function getConnection(lane: RpcLane): Connection {
  return lane === 'base' ? getBaseConnection() : getRouterConnection();
}

function buildProgram(keypair: Keypair, lane: RpcLane): Program {
  const provider = new AnchorProvider(
    getConnection(lane),
    new Wallet(keypair),
    AnchorProvider.defaultOptions(),
  );
  return new Program(battleIdl, provider);
}

function toPublicKey(value: AddressLike): PublicKey {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

function normalizeFixedBytes(value: FixedBytes, expectedLength: number, label: string): Uint8Array {
  const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
  if (bytes.length !== expectedLength) {
    throw new Error(`${label} must be exactly ${expectedLength} bytes, received ${bytes.length}`);
  }
  return bytes;
}

function normalizeCardId(cardId: string | Uint8Array): Uint8Array {
  if (cardId instanceof Uint8Array) {
    return normalizeFixedBytes(cardId, 16, 'cardId');
  }

  const trimmed = cardId.trim();
  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (/^[0-9a-fA-F]{32}$/.test(hex)) {
    return Uint8Array.from(Buffer.from(hex, 'hex'));
  }

  const utf8 = new TextEncoder().encode(trimmed);
  if (utf8.length > 16) {
    throw new Error(`cardId string must be <= 16 UTF-8 bytes or 32 hex chars, received ${utf8.length}`);
  }

  const padded = new Uint8Array(16);
  padded.set(utf8);
  return padded;
}

function decodeStatus(statusVariant: number): BattleSessionStatus {
  const statusMap: BattleSessionStatus[] = ['WaitingCards', 'Active', 'Finished', 'Cancelled'];
  return statusMap[statusVariant] || 'Cancelled';
}

function formatRoomId(roomId?: string): string {
  return roomId || '<unspecified>';
}

async function getAccountInfoAcrossLanes(pubkey: PublicKey) {
  const routerAccount = ROUTER_RPC_URL ? await getRouterConnection().getAccountInfo(pubkey) : null;
  if (routerAccount) return routerAccount;
  return getBaseConnection().getAccountInfo(pubkey);
}

async function getRegisteredCardId(cardPda: PublicKey): Promise<Uint8Array> {
  const account = await getAccountInfoAcrossLanes(cardPda);
  if (!account) {
    throw new Error(`RegisteredCard ${cardPda.toBase58()} not found on router or base RPC`);
  }

  const disc = 8;
  return account.data.subarray(disc + 32, disc + 48);
}

async function logInstruction<T>(
  meta: {
    roomId?: string;
    instruction: string;
    lane: RpcLane;
    sessionPda?: PublicKey;
    cardPda?: PublicKey;
  },
  runner: () => Promise<T>,
): Promise<T> {
  try {
    const result = await runner();
    const txSignature = typeof result === 'string'
      ? result
      : typeof result === 'object' && result && 'signature' in result
        ? String((result as { signature: string }).signature)
        : undefined;

    console.log('[MagicBlock] instruction ok', {
      roomId: formatRoomId(meta.roomId),
      instruction: meta.instruction,
      lane: meta.lane,
      sessionPda: meta.sessionPda?.toBase58(),
      cardPda: meta.cardPda?.toBase58(),
      txSignature,
    });
    return result;
  } catch (error) {
    console.error('[MagicBlock] instruction failed', {
      roomId: formatRoomId(meta.roomId),
      instruction: meta.instruction,
      lane: meta.lane,
      sessionPda: meta.sessionPda?.toBase58(),
      cardPda: meta.cardPda?.toBase58(),
      error,
    });
    throw error;
  }
}

function getWritableAccounts(transaction: Transaction): string[] {
  const writableAccounts = new Set<string>();
  for (const instruction of transaction.instructions) {
    instruction.keys
      .filter(account => account.isWritable)
      .forEach(account => writableAccounts.add(account.pubkey.toBase58()));
  }
  if (transaction.feePayer) {
    writableAccounts.add(transaction.feePayer.toBase58());
  }
  return Array.from(writableAccounts);
}

async function waitForSignatureStatus(
  connection: Connection,
  signature: string,
  options: {
    lastValidBlockHeight?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }

    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return;
    }

    if (typeof options.lastValidBlockHeight === 'number') {
      const currentBlockHeight = await connection.getBlockHeight('confirmed');
      if (currentBlockHeight > options.lastValidBlockHeight) {
        throw new Error(
          `Transaction expired before confirmation (lastValidBlockHeight=${options.lastValidBlockHeight}, currentBlockHeight=${currentBlockHeight})`,
        );
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for transaction confirmation: ${signature}`);
}

async function sendBaseTransaction(transaction: Transaction, serverKeypair: Keypair): Promise<string> {
  const connection = getBaseConnection();
  transaction.feePayer ??= serverKeypair.publicKey;
  const blockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;
  transaction.sign(serverKeypair as Signer);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await waitForSignatureStatus(connection, signature, {
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  return signature;
}

async function parseRouterJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Empty response body (status ${response.status})`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Non-JSON response body (status ${response.status}): ${snippet || '<empty>'}`,
    );
  }
}

async function getMagicRouterBlockhash(transaction: Transaction): Promise<MagicRouterBlockhash> {
  const connection = getRouterConnection();

  if (routerSupportsAccountScopedBlockhash !== false) {
    try {
      const response = await fetch(connection.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBlockhashForAccounts',
          params: [getWritableAccounts(transaction)],
        }),
      });
      const payload = await parseRouterJsonResponse(response) as {
        result?: { value?: { blockhash: string; lastValidBlockHeight: number } } | { blockhash: string; lastValidBlockHeight: number };
        error?: { code?: number; message?: string } | unknown;
      };

      if (!payload.error && payload.result) {
        routerSupportsAccountScopedBlockhash = true;
        const result = payload.result as { value?: MagicRouterBlockhash } | MagicRouterBlockhash;
        const blockhash = ('value' in result ? result.value : result) as MagicRouterBlockhash | undefined;
        if (!blockhash?.blockhash || typeof blockhash.lastValidBlockHeight !== 'number') {
          throw new Error(`Magic router returned invalid blockhash payload: ${JSON.stringify(payload)}`);
        }
        return blockhash;
      }

      const maybeError = payload.error as { code?: number; message?: string } | undefined;
      const methodMissing =
        maybeError?.code === -32601 ||
        maybeError?.message?.toLowerCase().includes('method not found');

      if (!methodMissing) {
        throw new Error(`Magic router getBlockhashForAccounts failed: ${JSON.stringify(payload.error ?? payload)}`);
      }

      routerSupportsAccountScopedBlockhash = false;
      console.warn(
        `[MagicBlock] Router endpoint ${connection.rpcEndpoint} does not support getBlockhashForAccounts. ` +
        `Falling back to getLatestBlockhash(); ER runtime support may be limited on this endpoint.`,
      );
    } catch (error) {
      routerSupportsAccountScopedBlockhash = false;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[MagicBlock] Router blockhash RPC returned an unusable response for ${connection.rpcEndpoint}. ` +
        `Falling back to getLatestBlockhash(). Details: ${message}`,
      );
    }
  }

  const fallback = await connection.getLatestBlockhash('confirmed');
  return {
    blockhash: fallback.blockhash,
    lastValidBlockHeight: fallback.lastValidBlockHeight,
  };
}

async function sendMagicRouterTransaction(transaction: Transaction, serverKeypair: Keypair): Promise<string> {
  transaction.feePayer ??= serverKeypair.publicKey;
  const blockhash = await getMagicRouterBlockhash(transaction);
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;
  transaction.sign(serverKeypair as Signer);

  const connection = getRouterConnection();
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await waitForSignatureStatus(connection, signature, {
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  return signature;
}

/**
 * Intended BE room flow for new rooms (inline manifest):
 * createSession -> setCardManifest(A) -> setCardManifest(B) -> activateSession ->
 * delegateBattleSession ->
 * applyEffect -> timeoutPlayerForRound / resolveRoundByState / cancelSession / surrenderMatch ->
 * commitBattleSession -> undelegateBattleSession.
 *
 * Legacy flow (still supported but not used for new rooms):
 * createSession -> registerCardV2 -> activateSession ->
 * delegateBattleSession -> delegateRegisteredCard ->
 * applyCardEffect -> ... -> commitRegisteredCard -> undelegateRegisteredCard.
 *
 * Notes for BE:
 * - BE chooses timeout vs resolve vs cancel based on connection-state facts.
 * - BE does not choose the winner for normal time-up rounds.
 * - resolveRoundByState lets ER resolve by health -> roundDamage -> draw.
 * - registerCard and applyDamage remain legacy compatibility wrappers only.
 */
export class MagicBlockService {
  async createSession(params: CreateSessionParams): Promise<{ sessionPda: string; signature: string }> {
    const matchId = params.matchId ? normalizeFixedBytes(params.matchId, 32, 'matchId') : deriveMatchId(params.roomId);
    const questionHash = normalizeFixedBytes(params.questionHash, 32, 'questionHash');
    const sessionPda = deriveBattleSessionPdaFromMatchId(matchId);
    const program = buildProgram(params.serverKeypair, 'base');
    const playerA = toPublicKey(params.playerA);
    const playerB = toPublicKey(params.playerB);

    return logInstruction(
      { roomId: params.roomId, instruction: 'createSession', lane: 'base', sessionPda },
      async () => {
        const transaction = await program.methods
          .createSession([...matchId], [...questionHash])
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            playerA,
            playerB,
            battleSession: sessionPda,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        const signature = await sendBaseTransaction(transaction, params.serverKeypair);

        return { sessionPda: sessionPda.toBase58(), signature };
      },
    );
  }

  async createBattleSession(
    params: LegacyCreateBattleSessionParams,
  ): Promise<{ sessionPda: string; signature: string }> {
    const matchId = normalizeFixedBytes(params.matchId, 32, 'matchId');
    const roomId = params.roomId || Buffer.from(matchId).toString('hex');

    return this.createSession({
      roomId,
      matchId,
      playerA: params.playerA,
      playerB: params.playerB,
      questionHash: params.questionHash,
      serverKeypair: params.serverKeypair,
    });
  }

  async registerCard(params: RegisterCardParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardId = normalizeCardId(params.cardId);
    const cardPda = deriveRegisteredCardPda(sessionPda, cardId);
    const program = buildProgram(params.serverKeypair, 'base');

    return logInstruction(
      { roomId: params.roomId, instruction: 'registerCard', lane: 'base', sessionPda, cardPda },
      async () => {
        const transaction = await program.methods
          // Legacy damage-only path. New flows should use registerCardV2.
          .registerCard([...cardId], params.damage)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async registerCardV2(params: RegisterCardV2Params): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const owner = toPublicKey(params.owner);
    const cardId = normalizeCardId(params.cardId);
    const cardPda = deriveRegisteredCardPda(sessionPda, cardId);
    const program = buildProgram(params.serverKeypair, 'base');

    return logInstruction(
      { roomId: params.roomId, instruction: 'registerCardV2', lane: 'base', sessionPda, cardPda },
      async () => {
        const transaction = await program.methods
          .registerCardV2([...cardId], owner, params.effectType, params.maxValue)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async activateSession(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'base');

    return logInstruction(
      { roomId: params.roomId, instruction: 'activateSession', lane: 'base', sessionPda },
      async () => {
        const transaction = await program.methods
          .activateSession()
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async setCardManifest(params: SetCardManifestParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'base');

    return logInstruction(
      { roomId: params.roomId, instruction: 'setCardManifest', lane: 'base', sessionPda },
      async () => {
        const transaction = await program.methods
          .setCardManifest(params.isPlayerA, params.totalSlots, Buffer.from(params.manifest))
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async applyEffect(params: ApplyEffectParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'applyEffect', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .applyEffect(params.slot, params.actorIsA, params.finalValue, params.scoreDelta)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async surrenderMatch(params: SurrenderMatchParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const surrenderingPlayer = toPublicKey(params.surrenderingPlayer);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'surrenderMatch', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .surrenderMatch(surrenderingPlayer)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async delegateBattleSession(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'base');
    const remainingAccounts = getOptionalValidatorRemainingAccounts();

    return logInstruction(
      { roomId: params.roomId, instruction: 'delegateBattleSession', lane: 'base', sessionPda },
      async () => {
        const builder = program.methods
          .delegateBattleSession()
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          });
        if (remainingAccounts) {
          builder.remainingAccounts(remainingAccounts);
        }
        const transaction = await builder.transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async delegateRegisteredCard(params: DelegateRegisteredCardParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardPda = toPublicKey(params.cardPda);
    const cardId = params.cardId ? normalizeCardId(params.cardId) : await getRegisteredCardId(cardPda);
    const program = buildProgram(params.serverKeypair, 'base');
    const remainingAccounts = getOptionalValidatorRemainingAccounts();

    return logInstruction(
      { roomId: params.roomId, instruction: 'delegateRegisteredCard', lane: 'base', sessionPda, cardPda },
      async () => {
        const builder = program.methods
          .delegateRegisteredCard([...cardId])
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
          });
        if (remainingAccounts) {
          builder.remainingAccounts(remainingAccounts);
        }
        const transaction = await builder.transaction();
        return sendBaseTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async applyDamage(params: ApplyDamageParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardPda = toPublicKey(params.cardPda);
    const attacker = toPublicKey(params.attacker);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'applyDamage', lane: 'router', sessionPda, cardPda },
      () => program.methods
        // Legacy damage-only compatibility path. New BE flow should use applyCardEffect.
        .applyDamage(attacker)
        .accountsPartial({
          authority: params.serverKeypair.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
    );
  }

  async applyCardEffect(params: ApplyCardEffectParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardPda = toPublicKey(params.cardPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'applyCardEffect', lane: 'router', sessionPda, cardPda },
      async () => {
        const transaction = await program.methods
          .applyCardEffect(params.finalValue, params.scoreDelta)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async timeoutPlayerForRound(params: TimeoutPlayerForRoundParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const timedOutPlayer = toPublicKey(params.timedOutPlayer);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'timeoutPlayerForRound', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .timeoutPlayerForRound(timedOutPlayer)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async resolveRoundByState(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'resolveRoundByState', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .resolveRoundByState()
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async cancelSession(params: CancelSessionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'cancelSession', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .cancelSession(params.reason)
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async forceEnd(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'forceEnd', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .forceEnd()
          .accountsPartial({
            authority: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async commitBattleSession(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'commitBattleSession', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .commitBattleSession()
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async commitRegisteredCard(params: SessionCardInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardPda = toPublicKey(params.cardPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'commitRegisteredCard', lane: 'router', sessionPda, cardPda },
      async () => {
        const transaction = await program.methods
          .commitRegisteredCard()
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async undelegateBattleSession(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'undelegateBattleSession', lane: 'router', sessionPda },
      async () => {
        const transaction = await program.methods
          .undelegateBattleSession()
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async undelegateRegisteredCard(params: SessionCardInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const cardPda = toPublicKey(params.cardPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'undelegateRegisteredCard', lane: 'router', sessionPda, cardPda },
      async () => {
        const transaction = await program.methods
          .undelegateRegisteredCard()
          .accounts({
            payer: params.serverKeypair.publicKey,
            battleSession: sessionPda,
            registeredCard: cardPda,
          })
          .transaction();
        return sendMagicRouterTransaction(transaction, params.serverKeypair);
      },
    );
  }

  async finalizeMatch(params: SessionInstructionParams): Promise<string> {
    const sessionPda = toPublicKey(params.sessionPda);
    const program = buildProgram(params.serverKeypair, 'router');

    return logInstruction(
      { roomId: params.roomId, instruction: 'finalizeMatch', lane: 'router', sessionPda },
      () => program.methods
        .finalizeMatch()
        .accountsPartial({
          authority: params.serverKeypair.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
    );
  }

  /**
   * Reads BattleSession from router first, then base layer as a fallback.
   *
   * Offsets below match the v5 on-chain BattleSession layout:
   * version(0) matchId(1) authority(33) playerA(65) playerB(97) healthA(129)
   * healthB(131) scoreA(133) scoreB(135) currentRound(137) roundsWonA(138)
   * roundsWonB(139) roundStartedAt(140) roundDeadline(148) missedA(156)
   * missedB(157) totalPlays(158) status(160) winner(161) questionHash(193)
   * bump(225) createdAt(226) finishedAt(234) endReason(242) gameScoreA(243)
   * gameScoreB(247) roundDamageA(251) roundDamageB(255)
   * -- v5 inline manifest additions --
   * totalSlotsA(259) totalSlotsB(260) cardsUsedA(261) cardsUsedB(277)
   * manifestCommittedA(293) manifestCommittedB(294)
   * cardManifestA(295..679) cardManifestB(679..1063)
   */
  async getSessionState(sessionPda: AddressLike): Promise<BattleSessionState> {
    const sessionKey = toPublicKey(sessionPda);
    const account = await getAccountInfoAcrossLanes(sessionKey);
    if (!account) {
      throw new Error(`BattleSession ${sessionKey.toBase58()} not found on router or base RPC`);
    }

    const data = account.data;
    const disc = 8;

    const authority = new PublicKey(data.subarray(disc + 33, disc + 65)).toBase58();
    const playerA = new PublicKey(data.subarray(disc + 65, disc + 97)).toBase58();
    const playerB = new PublicKey(data.subarray(disc + 97, disc + 129)).toBase58();
    const healthA = data.readUInt16LE(disc + 129);
    const healthB = data.readUInt16LE(disc + 131);
    const scoreA = data.readUInt16LE(disc + 133);
    const scoreB = data.readUInt16LE(disc + 135);
    const currentRound = data.readUInt8(disc + 137);
    const roundStartedAt = Number(data.readBigInt64LE(disc + 140));
    const roundDeadline = Number(data.readBigInt64LE(disc + 148));
    const totalPlays = data.readUInt16LE(disc + 158);
    const status = decodeStatus(data.readUInt8(disc + 160));
    const winnerKey = new PublicKey(data.subarray(disc + 161, disc + 193));
    const winner = winnerKey.equals(PublicKey.default) ? null : winnerKey.toBase58();
    const finishedAt = Number(data.readBigInt64LE(disc + 234));
    const endReason = data.readUInt8(disc + 242);
    const gameScoreA = data.readUInt32LE(disc + 243);
    const gameScoreB = data.readUInt32LE(disc + 247);
    const roundDamageA = data.readUInt32LE(disc + 251);
    const roundDamageB = data.readUInt32LE(disc + 255);

    // v5 inline manifest fields (safe even if account is old/short — default to 0/false)
    const hasV5Fields = data.length >= disc + 295;
    const totalSlotsA = hasV5Fields ? data.readUInt8(disc + 259) : 0;
    const totalSlotsB = hasV5Fields ? data.readUInt8(disc + 260) : 0;
    // cardsUsedA/B at 261..293 are u128 bitmasks — skip for state interface
    const manifestCommittedA = hasV5Fields ? data.readUInt8(disc + 293) !== 0 : false;
    const manifestCommittedB = hasV5Fields ? data.readUInt8(disc + 294) !== 0 : false;

    return {
      sessionPda: sessionKey.toBase58(),
      authority,
      playerA,
      playerB,
      status,
      healthA,
      healthB,
      scoreA,
      scoreB,
      gameScoreA,
      gameScoreB,
      roundDamageA,
      roundDamageB,
      currentRound,
      roundStartedAt,
      roundDeadline,
      winner,
      endReason,
      finishedAt,
      totalPlays,
      totalSlotsA,
      totalSlotsB,
      manifestCommittedA,
      manifestCommittedB,
    };
  }
}

/**
 * Pack an array of card definitions into the inline manifest byte format
 * expected by `set_card_manifest`.
 *
 * Each slot is 3 bytes: [effect_type, max_value_lo, max_value_hi]
 */
export function packCardManifest(
  cards: Array<{ effectType: number; maxValue: number }>,
): Uint8Array {
  const buf = new Uint8Array(cards.length * 3);
  for (let i = 0; i < cards.length; i++) {
    const { effectType, maxValue } = cards[i];
    buf[i * 3] = effectType;
    buf[i * 3 + 1] = maxValue & 0xff;        // low byte
    buf[i * 3 + 2] = (maxValue >> 8) & 0xff;  // high byte
  }
  return buf;
}

export const magicBlockService = new MagicBlockService();
