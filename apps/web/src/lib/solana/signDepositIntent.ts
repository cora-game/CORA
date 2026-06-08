import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Connection,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

type SignDepositIntentParams = {
  connection: Connection;
  wallet: WalletContextState;
  roomId: string;
  token: string;
  wagerUsd: string;
  signal?: AbortSignal;
};

type PrepareDepositIntentParams = Omit<SignDepositIntentParams, "connection">;
type SendDepositIntentParams = {
  connection: Connection;
  wallet: WalletContextState;
  transaction: Transaction;
  signal?: AbortSignal;
};

type SignSettlementReleaseIntentParams = {
  connection: Connection;
  wallet: WalletContextState;
  matchId: string;
  winner: string;
};

export class DepositIntentError extends Error {
  code:
    | "wallet_not_connected"
    | "wallet_signing_not_supported"
    | "wallet_declined"
    | "insufficient_balance"
    | "rpc_error"
    | "network_error"
    | "unknown";

  constructor(
    code:
      | "wallet_not_connected"
      | "wallet_signing_not_supported"
      | "wallet_declined"
      | "insufficient_balance"
      | "rpc_error"
      | "network_error"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "DepositIntentError";
  }
}

function isInsufficientBalanceText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lowered = value.toLowerCase();
  return (
    lowered.includes("insufficient") ||
    lowered.includes("balance") ||
    lowered.includes("fund")
  );
}

function isBackendInsufficientBalanceError(status: number, errorData: unknown): boolean {
  if (status === 402) return true;
  if (!errorData || typeof errorData !== "object") return false;

  const payload = errorData as Record<string, unknown>;
  return ["error", "message", "reason", "code"].some((key) => isInsufficientBalanceText(payload[key]));
}

function mapWalletError(error: unknown): DepositIntentError {
  if (error instanceof DepositIntentError) return error;

  const logs: string = (() => {
    if (error && typeof error === "object" && "logs" in error) {
      const value = (error as { logs?: unknown }).logs;
      if (Array.isArray(value)) return value.join(" ").toLowerCase();
    }
    return "";
  })();

  const message = error instanceof Error ? error.message : "Unknown wallet error";
  const lowered = message.toLowerCase();
  const combined = `${lowered} ${logs}`;
  if (lowered.includes("aborted") || (error instanceof Error && error.name.toLowerCase().includes("abort"))) {
    return new DepositIntentError("unknown", "signing_timeout");
  }

  // Network / fetch failures — the tunnel is down or backend unreachable
  if (
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("network request failed") ||
    lowered.includes("load failed") ||
    (error instanceof TypeError && lowered.includes("fetch"))
  ) {
    return new DepositIntentError("network_error", "Unable to reach the game server. Check your connection and retry.");
  }

  if (combined.includes("rejected") || combined.includes("denied") || combined.includes("cancel")) {
    return new DepositIntentError("wallet_declined", "Wallet request was declined.");
  }

  if (
    combined.includes("insufficient") ||
    combined.includes("lamport") ||
    logs.includes("0x1") ||
    combined.includes('"custom":1') ||
    combined.includes('"custom": 1') ||
    combined.includes("instructionerror")
  ) {
    return new DepositIntentError(
      "insufficient_balance",
      "Insufficient balance for transaction fees.",
    );
  }

  if (
    combined.includes("blockhash") ||
    combined.includes("block height exceeded") ||
    combined.includes("transaction expired") ||
    combined.includes("signature has expired") ||
    combined.includes("rpc")
  ) {
    return new DepositIntentError("rpc_error", "Transaction expired before confirmation. Close any stale wallet prompt and retry.");
  }

  if (combined.includes("failed on-chain")) {
    if (
      combined.includes('"custom":1') ||
      combined.includes('"custom": 1') ||
      combined.includes("instructionerror") ||
      combined.includes("insufficient") ||
      logs.includes("0x1")
    ) {
      return new DepositIntentError(
        "insufficient_balance",
        "Insufficient balance for transaction fees.",
      );
    }
    return new DepositIntentError("unknown", message);
  }

  return new DepositIntentError("unknown", message);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DepositIntentError("unknown", "signing_timeout");
  }
}

async function signMemoIntent({
  connection,
  wallet,
  memoMessage,
}: {
  connection: Connection;
  wallet: WalletContextState;
  memoMessage: string;
}): Promise<string> {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }

  if (!wallet.sendTransaction) {
    throw new DepositIntentError(
      "wallet_signing_not_supported",
      "Connected wallet does not support transaction signing.",
    );
  }

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoMessage, "utf8"),
  });

  const transaction = new Transaction().add(instruction);

  try {
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = latest.blockhash;

    const signature = await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      maxRetries: 2,
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );

    return signature;
  } catch (error) {
    throw mapWalletError(error);
  }
}

export async function signDepositIntent({
  connection,
  wallet,
  roomId,
  token,
  wagerUsd,
  signal,
}: SignDepositIntentParams): Promise<string> {
  const transaction = await prepareDepositIntentTransaction({
    wallet,
    roomId,
    token,
    wagerUsd,
    signal,
  });

  return sendDepositIntentTransaction({
    connection,
    wallet,
    transaction,
    signal,
  });
}

export async function prepareDepositIntentTransaction({
  wallet,
  roomId,
  token,
  wagerUsd,
  signal,
}: PrepareDepositIntentParams): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }

  try {
    throwIfAborted(signal);
    const apiBase = resolveApiBaseUrl();
    console.info("[signDepositIntent] Requesting backend deposit transaction", {
      roomId,
      token,
      wagerUsd,
      apiBase,
      account: wallet.publicKey.toBase58(),
    });

    const res = await fetch(`${apiBase}/api/actions/challenge?roomId=${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        account: wallet.publicKey.toBase58(),
        tokenMint: token,
        wagerAmount: Math.floor(parseFloat(wagerUsd) * 1_000_000),
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("[signDepositIntent] Backend transaction build failed", {
        status: res.status,
        errorData,
      });
      if (isBackendInsufficientBalanceError(res.status, errorData)) {
        throw new DepositIntentError("insufficient_balance", "Insufficient Balance");
      }
      throw new Error(
        errorData && typeof errorData === "object" && "message" in errorData && typeof errorData.message === "string"
          ? errorData.message
          : "Failed to fetch deposit transaction",
      );
    }

    const { transaction: base64Tx } = await res.json();
    throwIfAborted(signal);
    console.info("[signDepositIntent] Backend transaction received", {
      hasTransaction: Boolean(base64Tx),
    });
    const txBuffer = Buffer.from(base64Tx, "base64");
    const transaction = Transaction.from(txBuffer);

    transaction.feePayer = wallet.publicKey;
    return transaction;
  } catch (error) {
    throw mapWalletError(error);
  }
}

export async function sendDepositIntentTransaction({
  connection,
  wallet,
  transaction,
  signal,
}: SendDepositIntentParams): Promise<string> {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }
  if (!wallet.sendTransaction) {
    throw new DepositIntentError(
      "wallet_signing_not_supported",
      "Connected wallet does not support transaction signing.",
    );
  }

  try {

    // NOTE: Simulation removed — sendTransaction performs preflight simulation
    // automatically (preflightCommitment: "confirmed"). This removes one full
    // RPC round-trip before Phantom opens, which is critical over tunnels.

    console.info("[signDepositIntent] About to call wallet.sendTransaction", {
      feePayer: wallet.publicKey.toBase58(),
      blockhash: transaction.recentBlockhash,
    });
    throwIfAborted(signal);
    const signature = await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      maxRetries: 2,
    });

    // Return the signature immediately — don't block on confirmation.
    return signature;
  } catch (error) {
    throw mapWalletError(error);
  }
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }
  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim();
  if (wsUrl.startsWith("wss://")) {
    return trimTrailingSlash(`https://${wsUrl.slice("wss://".length)}`);
  }
  if (wsUrl.startsWith("ws://")) {
    return trimTrailingSlash(`http://${wsUrl.slice("ws://".length)}`);
  }
  return trimTrailingSlash(wsUrl);
}

export async function signSettlementReleaseIntent({
  connection,
  wallet,
  matchId,
  winner,
}: SignSettlementReleaseIntentParams): Promise<string> {
  const memoMessage = `CORA_SETTLEMENT_RELEASE:${matchId}:${winner}:${wallet.publicKey?.toBase58() ?? "unknown"}`;
  return signMemoIntent({
    connection,
    wallet,
    memoMessage,
  });
}
