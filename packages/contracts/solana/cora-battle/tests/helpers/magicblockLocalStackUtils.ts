// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Keypair, PublicKey, Signer, Transaction } from "@solana/web3.js";
import { getWritableAccounts } from "magic-router-sdk";

import idl from "../../target/idl/cora_battle.json";
import { CoraBattle } from "../../target/types/cora_battle";

import {
  authority,
  DECLARED_BATTLE_PROGRAM_ID,
  program,
} from "./battleTestUtils";

const DEFAULT_BASE_RPC = "http://127.0.0.1:8899";
const DEFAULT_EPHEMERAL_RPC = "http://127.0.0.1:7799";
const DEFAULT_EPHEMERAL_WS = "ws://127.0.0.1:7800";
const DEFAULT_LOCAL_ER_VALIDATOR = "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev";

const correctedIdl = {
  ...idl,
  address: DECLARED_BATTLE_PROGRAM_ID,
};

export const MAGICBLOCK_LOCAL_STACK_ENABLED =
  process.env.ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS === "1";

export const MAGICBLOCK_LOCAL_STACK_READY =
  MAGICBLOCK_LOCAL_STACK_ENABLED &&
  Boolean(process.env.EPHEMERAL_PROVIDER_ENDPOINT || DEFAULT_EPHEMERAL_RPC);

export const describeMagicBlockLocalStack = MAGICBLOCK_LOCAL_STACK_ENABLED
  ? describe
  : describe.skip;

export function getBaseRpcUrl(): string {
  return process.env.ANCHOR_PROVIDER_URL || DEFAULT_BASE_RPC;
}

export function getEphemeralRpcUrl(): string {
  return process.env.EPHEMERAL_PROVIDER_ENDPOINT || DEFAULT_EPHEMERAL_RPC;
}

export function getEphemeralWsUrl(): string {
  return process.env.EPHEMERAL_WS_ENDPOINT || DEFAULT_EPHEMERAL_WS;
}

function isLocalEndpoint(url: string): boolean {
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.startsWith("http://0.0.0.0")
  );
}

export function getLocalValidatorIdentity(): PublicKey {
  return new PublicKey(
    process.env.MAGICBLOCK_LOCAL_VALIDATOR_IDENTITY ||
      DEFAULT_LOCAL_ER_VALIDATOR
  );
}

function loadWalletKeypair(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET || join(homedir(), ".config/solana/id.json");
  const secretKey = Uint8Array.from(
    JSON.parse(readFileSync(walletPath, "utf8")) as number[]
  );
  return Keypair.fromSecretKey(secretKey);
}

export function makeProgramForEndpoint(
  endpoint: string,
  wsEndpoint?: string
): anchor.Program<CoraBattle> {
  const keypair = loadWalletKeypair();
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(endpoint, {
      commitment: "confirmed",
      wsEndpoint,
    }),
    new anchor.Wallet(keypair),
    anchor.AnchorProvider.defaultOptions()
  );

  return new anchor.Program<CoraBattle>(correctedIdl as CoraBattle, provider);
}

export const baseProgram = program;
export const ephemeralProgram = makeProgramForEndpoint(
  getEphemeralRpcUrl(),
  getEphemeralWsUrl()
);
export const localValidatorIdentity = getLocalValidatorIdentity();
const authoritySigner = (authority as anchor.Wallet & { payer?: Keypair }).payer
  ?? loadWalletKeypair();

type MagicBlockhashResult = {
  blockhash: string;
  lastValidBlockHeight: number;
};

async function getLocalMagicBlockhashForTransaction(
  transaction: Transaction
): Promise<MagicBlockhashResult> {
  const writableAccounts = getWritableAccounts(transaction);
  const response = await fetch(getEphemeralRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBlockhashForAccounts",
      params: [writableAccounts],
    }),
  });
  const payload = await response.json();
  return payload?.result?.value ?? payload?.result;
}

export async function sendMagicRouterTransaction(
  transaction: Transaction,
  signers: Signer[] = [authoritySigner]
): Promise<string> {
  transaction.feePayer ??= authority.publicKey;
  const blockhash = await getLocalMagicBlockhashForTransaction(transaction);
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;
  transaction.sign(...signers);

  const connection = ephemeralProgram.provider.connection;
  const signature = await connection.sendRawTransaction(transaction.serialize());
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(
      `Magic router transaction failed: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  return signature;
}

export async function waitForCondition(
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000,
  intervalMs = 500
): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError) {
    throw new Error(
      `Timed out waiting for ${label}. Last error: ${String(lastError)}`
    );
  }

  throw new Error(`Timed out waiting for ${label}`);
}

export async function fetchOwner(
  targetProgram: anchor.Program<CoraBattle>,
  pubkey: PublicKey
): Promise<PublicKey | null> {
  const account = await targetProgram.provider.connection.getAccountInfo(pubkey);
  return account?.owner ?? null;
}

export async function confirmEphemeralAccountVisible(
  pubkey: PublicKey,
  accountType: "battleSession" | "registeredCard"
): Promise<void> {
  await waitForCondition(
    `${accountType} visibility on ephemeral lane`,
    async () => {
      if (accountType === "battleSession") {
        await ephemeralProgram.account.battleSession.fetch(pubkey);
      } else {
        await ephemeralProgram.account.registeredCard.fetch(pubkey);
      }
      return true;
    }
  );
}

export async function waitForMagicBlockRpcReady(): Promise<void> {
  const endpoint = getEphemeralRpcUrl();
  const strictIdentityCheck =
    process.env.MAGICBLOCK_STRICT_IDENTITY_CHECK === "1" ||
    isLocalEndpoint(endpoint);

  await waitForCondition("MagicBlock local RPC readiness", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getIdentity",
        params: [],
      }),
    });
    const payload = await response.json();
    if (strictIdentityCheck) {
      return payload?.result?.identity === localValidatorIdentity.toBase58();
    }
    return Boolean(payload?.result?.identity);
  });
}

export function assertMagicBlockLocalStackEnv(): void {
  if (!MAGICBLOCK_LOCAL_STACK_ENABLED) {
    throw new Error(
      "MagicBlock local stack tests are disabled. Set ENABLE_MAGICBLOCK_LOCAL_STACK_TESTS=1."
    );
  }

  if (!authority?.publicKey) {
    throw new Error("Anchor authority wallet is not configured.");
  }
}
