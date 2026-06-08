import {
  type BlockhashWithExpiryBlockHeight,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, NATIVE_MINT } from '@solana/spl-token';
import { ESCROW_CONSTANTS } from '@shared/escrow';
import type { Room } from '../managers/room/types';
import { CORA_ESCROW_PROGRAM_ID, ESCROW_INSTRUCTION_DISCRIMINATORS } from '../config/solana';
import { serverPublicKey as SERVER_PUBLIC_KEY } from '../utils/settlement';
import { DEVNET_TOKEN_MINTS, resolveTokenMint } from '../config/tokens';

export { resolveTokenMint };

type DepositTransactionRoom = Pick<Room, 'id' | 'matchIdBytes' | 'tokenMint' | 'wagerAmount' | 'playerB'>;

type BuildDepositOptions = boolean | {
  initializeMatch?: boolean;
  initializeOpponent?: string;
};

export class BlinkTransactionBuilder {
  private static cachedBlockhash: { value: BlockhashWithExpiryBlockHeight; fetchedAt: number } | null = null;
  private static pendingBlockhash: Promise<BlockhashWithExpiryBlockHeight> | null = null;
  private static readonly BLOCKHASH_CACHE_MS = 20_000;

  private static async getRecentBlockhash(conn: Connection): Promise<BlockhashWithExpiryBlockHeight> {
    const now = Date.now();
    if (
      this.cachedBlockhash &&
      now - this.cachedBlockhash.fetchedAt < this.BLOCKHASH_CACHE_MS
    ) {
      return this.cachedBlockhash.value;
    }

    if (!this.pendingBlockhash) {
      this.pendingBlockhash = conn.getLatestBlockhash('confirmed')
        .then((value) => {
          this.cachedBlockhash = { value, fetchedAt: Date.now() };
          return value;
        })
        .finally(() => {
          this.pendingBlockhash = null;
        });
    }

    return this.pendingBlockhash;
  }

  /**
   * Builds an unsigned `create_open_challenge` transaction for the creator.
   * Creator funds the challenge escrow before any opponent is known.
   */
  public static async buildCreateOpenChallengeTransaction(
    account: string,
    matchIdBytes: Uint8Array,
    tokenMint: string,
    wagerAmount: bigint,
  ): Promise<string> {
    const creator = new PublicKey(account);
    const mint = new PublicKey(tokenMint);

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await this.getRecentBlockhash(conn);

    const [challengeStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.CHALLENGE_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );
    const [challengeVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.CHALLENGE_VAULT_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );

    const creatorATA = getAssociatedTokenAddressSync(mint, creator, true);

    const tx = new Transaction({
      recentBlockhash: latest.blockhash,
      feePayer: creator,
    });

    // Ensure creator ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        creator,
        creatorATA,
        creator,
        mint
      )
    );

    // wSOL wrap if native SOL
    if (mint.equals(NATIVE_MINT)) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: creator,
          toPubkey: creatorATA,
          lamports: wagerAmount,
        }),
        createSyncNativeInstruction(creatorATA)
      );
    }

    // Build create_open_challenge instruction data
    // Layout: 8 (discriminator) + 32 (match_id) + 8 (wager_amount) + 32 (server_pubkey) = 80 bytes
    // Use the shared server public key (ephemeral fallback for local dev) so the
    // embedded pubkey always matches the one used at settlement time.
    const serverPubkey = new PublicKey(SERVER_PUBLIC_KEY);

    const wagerAmountBuffer = Buffer.alloc(8);
    wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount));

    const data = Buffer.concat([
      ESCROW_INSTRUCTION_DISCRIMINATORS.createOpenChallenge,
      Buffer.from(matchIdBytes),
      wagerAmountBuffer,
      serverPubkey.toBuffer(),
    ]);

    // Account order matches IDL: creator, token_mint, challenge_state, challenge_vault, creator_token_account, token_program, system_program
    const ix = new TransactionInstruction({
      programId: CORA_ESCROW_PROGRAM_ID,
      data,
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: challengeStatePDA, isSigner: false, isWritable: true },
        { pubkey: challengeVaultPDA, isSigner: false, isWritable: true },
        { pubkey: creatorATA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    });
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return serialized.toString('base64');
  }

  /**
   * Builds an unsigned `accept_challenge` transaction for the challenger.
   * Migrates creator's wager from challenge vault into final MatchState + vault,
   * adds challenger's wager, and closes temporary challenge accounts (rent → creator).
   */
  public static async buildAcceptChallengeTransaction(
    account: string,
    matchIdBytes: Uint8Array,
    tokenMint: string,
    creatorPubkey: string,
    wagerAmount: bigint,
  ): Promise<string> {
    const challenger = new PublicKey(account);
    const creator = new PublicKey(creatorPubkey);
    const mint = new PublicKey(tokenMint);

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await this.getRecentBlockhash(conn);

    // Challenge PDAs (temporary, will be closed)
    const [challengeStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.CHALLENGE_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );
    const [challengeVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.CHALLENGE_VAULT_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );

    // Final escrow PDAs (created by accept_challenge)
    const [matchStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );

    const challengerATA = getAssociatedTokenAddressSync(mint, challenger, true);

    const tx = new Transaction({
      recentBlockhash: latest.blockhash,
      feePayer: challenger,
    });

    // Ensure challenger ATA exists
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        challenger,
        challengerATA,
        challenger,
        mint
      )
    );

    // If native SOL, wrap it into wSOL
    if (mint.equals(NATIVE_MINT)) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: challenger,
          toPubkey: challengerATA,
          lamports: wagerAmount,
        }),
        createSyncNativeInstruction(challengerATA)
      );
    }

    // Build accept_challenge instruction data
    // Layout: 8 (discriminator) + 32 (match_id) = 40 bytes
    const data = Buffer.concat([
      ESCROW_INSTRUCTION_DISCRIMINATORS.acceptChallenge,
      Buffer.from(matchIdBytes),
    ]);

    // Account order matches IDL: challenger, creator, challenge_state, challenge_vault, token_mint,
    //   match_state, vault, challenger_token_account, token_program, system_program
    const ix = new TransactionInstruction({
      programId: CORA_ESCROW_PROGRAM_ID,
      data,
      keys: [
        { pubkey: challenger, isSigner: true, isWritable: true },
        { pubkey: creator, isSigner: false, isWritable: true },
        { pubkey: challengeStatePDA, isSigner: false, isWritable: true },
        { pubkey: challengeVaultPDA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: matchStatePDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: challengerATA, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    });
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return serialized.toString('base64');
  }

  /**
   * Builds an unsigned deposit_wager transaction for a player.
   * Used by public FIFO matchmaking — NOT used by Blink true flow.
   */
  public static async buildDepositTransaction(
    account: string,
    room: DepositTransactionRoom,
    options: BuildDepositOptions
  ): Promise<string> {
    const initializeMatch = typeof options === 'boolean' ? options : Boolean(options.initializeMatch);
    const initializeOpponent = typeof options === 'boolean' ? room.playerB : options.initializeOpponent ?? room.playerB;
    const depositor = new PublicKey(account);
    const tokenMint = new PublicKey(room.tokenMint!);
    const wagerAmount = room.wagerAmount!;

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await this.getRecentBlockhash(conn);
    const matchIdBytes = room.matchIdBytes;

    const [matchStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.MATCH_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_CONSTANTS.VAULT_SEED), matchIdBytes],
      CORA_ESCROW_PROGRAM_ID,
    );

    const depositorATA = getAssociatedTokenAddressSync(tokenMint, depositor, true);
    
    const tx = new Transaction({
      recentBlockhash: latest.blockhash,
      feePayer: depositor,
    });

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        depositor,
        depositorATA,
        depositor,
        tokenMint
      )
    );

    if (tokenMint.toBase58() === DEVNET_TOKEN_MINTS.SOL) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: depositor,
          toPubkey: depositorATA,
          lamports: wagerAmount,
        }),
        createSyncNativeInstruction(depositorATA)
      );
    }

    if (initializeMatch) {
      // Use the shared server public key (ephemeral fallback for local dev) so the
      // embedded pubkey always matches the one used at settlement time.
      const serverPubkey = new PublicKey(SERVER_PUBLIC_KEY);

      const wagerAmountBuffer = Buffer.alloc(8);
      wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount));
      
      const initData = Buffer.concat([
        ESCROW_INSTRUCTION_DISCRIMINATORS.initializeMatch,
        Buffer.from(matchIdBytes),
        wagerAmountBuffer,
        serverPubkey.toBuffer()
      ]);

      const initIx = new TransactionInstruction({
        programId: CORA_ESCROW_PROGRAM_ID,
        data: initData,
        keys: [
          { pubkey: depositor, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(initializeOpponent || account), isSigner: false, isWritable: false },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: matchStatePDA, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
      });
      tx.add(initIx);
    }

    const depositWagerIx = new TransactionInstruction({
      programId: CORA_ESCROW_PROGRAM_ID,
      data: ESCROW_INSTRUCTION_DISCRIMINATORS.depositWager,
      keys: [
        { pubkey: depositor,      isSigner: true,  isWritable: true  },
        { pubkey: matchStatePDA,  isSigner: false, isWritable: true  },
        { pubkey: depositorATA,   isSigner: false, isWritable: true  },
        { pubkey: vaultPDA,       isSigner: false, isWritable: true  },
        { pubkey: tokenMint,      isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
    });

    tx.add(depositWagerIx);

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return serialized.toString('base64');
  }
}
