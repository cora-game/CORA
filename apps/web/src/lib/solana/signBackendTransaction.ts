import { Transaction, type Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { DepositIntentError } from "./signDepositIntent";

function mapBackendTransactionError(error: unknown): DepositIntentError {
  if (error instanceof DepositIntentError) return error;

  const message = error instanceof Error ? error.message : "Unknown wallet error";
  const lowered = message.toLowerCase();
  if (lowered.includes("rejected") || lowered.includes("denied") || lowered.includes("cancel")) {
    return new DepositIntentError("wallet_declined", "Wallet request was declined.");
  }
  if (lowered.includes("insufficient") || lowered.includes("lamport") || lowered.includes("balance")) {
    return new DepositIntentError("insufficient_balance", "Insufficient Balance");
  }
  if (lowered.includes("blockhash") || lowered.includes("expired") || lowered.includes("rpc")) {
    return new DepositIntentError("rpc_error", "Transaction expired before confirmation. Please retry.");
  }
  return new DepositIntentError("unknown", message);
}

export async function signBackendTransaction({
  connection,
  wallet,
  base64Transaction,
}: {
  connection: Connection;
  wallet: WalletContextState;
  base64Transaction: string;
}) {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }
  if (!wallet.sendTransaction) {
    throw new DepositIntentError("wallet_signing_not_supported", "Connected wallet does not support transaction signing.");
  }

  try {
    const transaction = Transaction.from(Buffer.from(base64Transaction, "base64"));
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.feePayer = wallet.publicKey;

    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      const raw = `${JSON.stringify(simulation.value.err)} ${(simulation.value.logs ?? []).join(" ")}`.toLowerCase();
      if (raw.includes("insufficient") || raw.includes("lamport") || raw.includes("0x1")) {
        throw new DepositIntentError("insufficient_balance", "Insufficient Balance");
      }
      throw new DepositIntentError("unknown", "Transaction simulation failed");
    }

    const signature = await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      maxRetries: 0,
    });

    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    throw mapBackendTransactionError(error);
  }
}
