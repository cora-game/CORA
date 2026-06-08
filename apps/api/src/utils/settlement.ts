import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { buildSettlementMessage, ESCROW_CONSTANTS } from '@shared/escrow';
import {
  anchorDiscriminator,
  CORA_ESCROW_PROGRAM_ID,
  ESCROW_INSTRUCTION_DISCRIMINATORS,
  MATCH_STATE_LAYOUT,
} from '../config/solana';

/**
 * Loads the server keypair from the environment variable.
 * Fallback to a randomly generated one for local development if not provided,
 * but logs a loud warning.
 */
export function getServerKeypair(): Keypair {
  const secretEnv = process.env.SERVER_KEYPAIR;

  if (!secretEnv) {
    console.warn('⚠️  WARNING: SERVER_KEYPAIR is missing in .env! Generating an ephemeral throwaway keypair for this session. Do NOT do this in production.');
    return Keypair.generate();
  }

  try {
    // Try passing it as a JSON array of numbers first (standard solana-keygen format)
    if (secretEnv.startsWith('[')) {
      const secretBytes = Uint8Array.from(JSON.parse(secretEnv));
      return Keypair.fromSecretKey(secretBytes);
    }
    
    // Otherwise fallback to trying base58 decode (Phantom export format)
    const secretBytes = bs58.decode(secretEnv);
    return Keypair.fromSecretKey(secretBytes);
  } catch (error) {
    console.error('Failed to parse SERVER_KEYPAIR environment variable. Must be a JSON array or Base58 string.');
    throw error;
  }
}

const serverKeypair = getServerKeypair();
export const serverPublicKey = serverKeypair.publicKey.toBase58();

/**
 * Signs the settlement payload using the shared message format.
 * The signed message exactly matches what the Anchor program reconstructs and verifies.
 *
 * Message format (defined in @cora/shared-types/escrow):
 *   65 bytes: action (1 byte) + match_id (32 bytes) + target_pubkey (32 bytes)
 *
 * @param action 0 for Normal (winner), 1 for Anti-Cheat (cheater)
 * @param matchId The 32-byte match ID
 * @param targetAddress The Solana public key of the target (winner or cheater)
 * @returns Base58 encoded signature that the client or server can submit on-chain
 */
export function signSettlementAuthorization(
  action: number,
  matchId: Uint8Array,
  targetAddress: string,
): string {
  const messageBytes = buildSettlementMessage(action, matchId, targetAddress);

  // Sign using Ed25519 (standard Solana signature)
  const signatureBytes = nacl.sign.detached(messageBytes, serverKeypair.secretKey);

  // Return signature encoded in Base58 for easy transportation & Anchor parsing
  return bs58.encode(signatureBytes);
}

// Singleton connection — reuse instead of creating per call (avoids connection churn)
const rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const wsUrl = process.env.SOLANA_WS_URL;
const hasExplicitRpc = Boolean(process.env.SOLANA_RPC_URL);
const connection = new Connection(rpcUrl, {
  commitment: 'confirmed',
  ...(wsUrl ? { wsEndpoint: wsUrl } : {}),
});
console.log(`[Settlement] Using Solana RPC: ${rpcUrl}${hasExplicitRpc ? '' : ' (default — set SOLANA_RPC_URL in .env for on-chain settlement)'}`);

// ProgramConfig PDA — derived once, reused for every settle_match call
const configPda = PublicKey.findProgramAddressSync(
  [Buffer.from(ESCROW_CONSTANTS.CONFIG_SEED)],
  CORA_ESCROW_PROGRAM_ID
)[0];

/**
 * Retry helper with exponential backoff for transient RPC errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxRetries;
      if (isLast) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Settlement] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`, (err as Error).message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

/**
 * Submits the settle_match transaction directly to the Solana blockchain,
 * handling the funds movement entirely server-side.
 *
 * @param action 0 for Normal (winner), 1 for Anti-Cheat (cheater)
 * @param matchId 32-byte match ID array
 * @param targetAddress Public key string of the target
 * @returns Solana Transaction Hash
 */
export async function submitSettlementTransaction(
  action: number,
  matchId: Uint8Array,
  targetAddress: string,
): Promise<string> {
  // Skip on-chain settlement when no RPC is configured (local dev / testing)
  if (!hasExplicitRpc) {
    console.log(`[Settlement] Skipped — no SOLANA_RPC_URL configured. Set it in .env to enable on-chain settlement.`);
    return 'SKIPPED_NO_RPC';
  }

  const matchStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchId],
    CORA_ESCROW_PROGRAM_ID
  )[0];
  const vaultPda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchId],
    CORA_ESCROW_PROGRAM_ID
  )[0];

  const accountInfo = await withRetry(() => connection.getAccountInfo(matchStatePda));
  if (!accountInfo) {
    console.warn(`[Settlement] MatchState PDA not found on-chain. Either the match was never initialized, or it was already settled/refunded (account closed). Skipping.`);
    return 'SKIPPED_NO_ONCHAIN_MATCH';
  }

  // Parse MatchState manually to avoid heavy IDL dependency
  // Layout (v1): 8 (discriminator) + 1 (version) + 32 (match_id) + 32 (player_a) + 32 (player_b) + 32 (token_mint) + ...
  const matchStateData = accountInfo.data;
  const playerA = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.playerA));
  const playerB = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.playerB));
  const tokenMint = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.tokenMint));

  const targetPubkey = new PublicKey(targetAddress);
  
  // ATAs
  const playerATa = getAssociatedTokenAddressSync(tokenMint, playerA, true);
  const playerBTa = getAssociatedTokenAddressSync(tokenMint, playerB, true);
  
  const treasuryKey = process.env.TREASURY_PUBKEY 
    ? new PublicKey(process.env.TREASURY_PUBKEY) 
    : serverKeypair.publicKey;
  const treasuryTa = getAssociatedTokenAddressSync(tokenMint, treasuryKey, true);

  const messageBytes = buildSettlementMessage(action, matchId, targetAddress);
  const signatureBytes = nacl.sign.detached(messageBytes, serverKeypair.secretKey);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: serverKeypair.publicKey.toBytes(),
    message: messageBytes,
    signature: signatureBytes,
  });

  // Construct settle_match instruction data
  // Buffer size: 8 (discriminator) + 1 (action) + 32 (target) + 64 (signature) = 105 bytes
  const data = Buffer.alloc(105);
  data.set(ESCROW_INSTRUCTION_DISCRIMINATORS.settleMatch, 0);
  data.writeUInt8(action, 8);
  data.set(targetPubkey.toBytes(), 9);
  data.set(signatureBytes, 41);

  // Account order must match the IDL exactly:
  // 0: caller (signer, writable)
  // 1: matchState PDA (writable)
  // 2: vault PDA (writable)
  // 3: playerATokenAccount (writable)
  // 4: playerBTokenAccount (writable)
  // 5: config PDA (read-only) — ProgramConfig, added in Entry 6
  // 6: treasury (writable)
  // 7: tokenMint (read-only)
  // 8: tokenProgram (read-only)
  // 9: instructionsSysvar (read-only)
  const settleMatchIx = new TransactionInstruction({
    programId: CORA_ESCROW_PROGRAM_ID,
    data,
    keys: [
      { pubkey: serverKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: matchStatePda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: playerATa, isSigner: false, isWritable: true },
      { pubkey: playerBTa, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: treasuryTa, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
  });

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      serverKeypair.publicKey, // payer
      treasuryTa, // ata
      treasuryKey, // owner
      tokenMint // mint
    ),
    ed25519Ix,
    settleMatchIx
  );
  
  console.log(`[Settlement] Submitting settle_match for match: ${Buffer.from(matchId).toString('hex')}`);
  console.log(`[Settlement] Target: ${targetAddress}`);
  
  const txHash = await withRetry(() => sendAndConfirmTransaction(connection, tx, [serverKeypair]));
  console.log(`[Settlement] Success! TxHash: ${txHash}`);
  console.log(`[Settlement] MatchState PDA and Vault closed on-chain. Rent reclaimed by caller.`);
  
  return txHash;
}

/**
 * Submits the refund transaction directly to the Solana blockchain.
 *
 * Used only for draw/server-error outcomes. The current on-chain refund
 * instruction is timeout-gated, so this will fail until the deployed program
 * allows immediate referee refunds for those outcomes.
 */
export async function submitRefundTransaction(matchId: Uint8Array): Promise<string> {
  if (!hasExplicitRpc) {
    console.log(`[Refund] Skipped - no SOLANA_RPC_URL configured. Set it in .env to enable on-chain refunds.`);
    return 'SKIPPED_NO_RPC';
  }

  const matchStatePda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchId],
    CORA_ESCROW_PROGRAM_ID
  )[0];
  const vaultPda = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchId],
    CORA_ESCROW_PROGRAM_ID
  )[0];

  const accountInfo = await withRetry(() => connection.getAccountInfo(matchStatePda));
  if (!accountInfo) {
    console.warn(`[Refund] MatchState PDA not found on-chain. It may already be settled/refunded. Skipping.`);
    return 'SKIPPED_NO_ONCHAIN_MATCH';
  }

  const matchStateData = accountInfo.data;
  const playerA = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.playerA));
  const playerB = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.playerB));
  const tokenMint = new PublicKey(matchStateData.subarray(...MATCH_STATE_LAYOUT.tokenMint));

  const playerATa = getAssociatedTokenAddressSync(tokenMint, playerA, true);
  const playerBTa = getAssociatedTokenAddressSync(tokenMint, playerB, true);

  const refundIx = new TransactionInstruction({
    programId: CORA_ESCROW_PROGRAM_ID,
    data: anchorDiscriminator('refund'),
    keys: [
      { pubkey: serverKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: matchStatePda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: playerATa, isSigner: false, isWritable: true },
      { pubkey: playerBTa, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
  });

  const tx = new Transaction().add(refundIx);
  console.log(`[Refund] Submitting refund for match: ${Buffer.from(matchId).toString('hex')}`);

  const txHash = await withRetry(() => sendAndConfirmTransaction(connection, tx, [serverKeypair]));
  console.log(`[Refund] Success! TxHash: ${txHash}`);
  return txHash;
}
