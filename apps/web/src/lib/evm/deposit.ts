"use client";

import { writeContract, waitForTransactionReceipt, readContract } from "@wagmi/core";
import { type Hex, type Address } from "viem";
import { deriveMatchId, resolveToken, isNativeEth, NATIVE_ETH_ADDRESS } from "@shared/escrow";
import { ERC20_ABI } from "@shared/escrowAbi";
import { wagmiConfig, ESCROW_ADDRESS, CORA_ESCROW_ABI } from "@/lib/evm/config";

/**
 * EVM deposit / challenge flow for CoraEscrow on Base Sepolia. Supports both the
 * native-ETH wager and an ERC-20 wager (USDC). For ERC-20, the wallet must
 * approve the escrow to pull the stake before the deposit — this helper handles
 * that automatically (checks allowance, approves if needed).
 */

export type DepositErrorCode =
  | "wallet_not_connected"
  | "wallet_signing_not_supported"
  | "wallet_declined"
  | "insufficient_balance"
  | "rpc_error"
  | "network_error"
  | "wrong_network"
  | "unknown";

export class DepositIntentError extends Error {
  code: DepositErrorCode;
  constructor(code: DepositErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DepositIntentError";
  }
}

function mapWalletError(error: unknown): DepositIntentError {
  if (error instanceof DepositIntentError) return error;
  const message = error instanceof Error ? error.message : "Unknown wallet error";
  const lowered = message.toLowerCase();

  if (lowered.includes("user rejected") || lowered.includes("rejected") || lowered.includes("denied") || lowered.includes("cancel")) {
    return new DepositIntentError("wallet_declined", "Wallet request was declined.");
  }
  if (lowered.includes("insufficient funds") || lowered.includes("insufficient") || lowered.includes("exceeds balance") || lowered.includes("transfer amount exceeds")) {
    return new DepositIntentError("insufficient_balance", "Insufficient balance for the wager + gas.");
  }
  if (lowered.includes("chain") || (lowered.includes("network") && lowered.includes("switch"))) {
    return new DepositIntentError("wrong_network", "Switch your wallet to Base Sepolia and retry.");
  }
  if (lowered.includes("failed to fetch") || lowered.includes("networkerror") || lowered.includes("timeout")) {
    return new DepositIntentError("network_error", "Network error reaching Base Sepolia. Check your connection and retry.");
  }
  return new DepositIntentError("unknown", message);
}

export interface DepositParams {
  /** The room id; the on-chain matchId is derived from it. */
  roomId: string;
  /** Per-player wager, in base units (wei for ETH, 6-dp for USDC). */
  wagerWei: bigint;
  /** Token symbol ("ETH" | "USDC") or 0x address. Defaults to ETH. */
  token?: string;
}

/** Resolve a token symbol/address to its on-chain address (address(0) = ETH). */
function tokenAddress(token: string | undefined): Address {
  if (isNativeEth(token)) return NATIVE_ETH_ADDRESS;
  return (resolveToken(token)?.address ?? NATIVE_ETH_ADDRESS) as Address;
}

/** For an ERC-20 wager, ensure the escrow has sufficient allowance (approve if not). */
async function ensureAllowance(owner: Address, erc20: Address, amount: bigint): Promise<void> {
  const current = (await readContract(wagmiConfig, {
    address: erc20,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, ESCROW_ADDRESS],
  })) as bigint;
  if (current >= amount) return;

  const approveHash = await writeContract(wagmiConfig, {
    address: erc20,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ESCROW_ADDRESS, amount],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
}

async function getAccount(): Promise<Address> {
  const { getAccount: read } = await import("@wagmi/core");
  const acct = read(wagmiConfig);
  if (!acct.address) throw new DepositIntentError("wallet_not_connected", "Connect your wallet first.");
  return acct.address;
}

/**
 * `deposit(matchId)` with the wager (ETH as value, or ERC-20 via approve+pull).
 * Returns the tx hash (used as the WS `confirmDeposit` signature).
 */
export async function depositToMatch({ roomId, wagerWei, token }: DepositParams): Promise<Hex> {
  if (!ESCROW_ADDRESS) throw new DepositIntentError("unknown", "Escrow contract address is not configured.");
  const matchId = deriveMatchId(roomId);
  const erc20 = tokenAddress(token);

  try {
    if (erc20 === NATIVE_ETH_ADDRESS) {
      const hash = await writeContract(wagmiConfig, {
        address: ESCROW_ADDRESS,
        abi: CORA_ESCROW_ABI,
        functionName: "deposit",
        args: [matchId],
        value: wagerWei,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      return hash;
    }

    const owner = await getAccount();
    await ensureAllowance(owner, erc20, wagerWei);
    const hash = await writeContract(wagmiConfig, {
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: "deposit",
      args: [matchId],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    return hash;
  } catch (error) {
    throw mapWalletError(error);
  }
}

/** `createOpenChallenge(matchId, token, wager)`. Returns the tx hash. */
export async function createOpenChallengeTx({ roomId, wagerWei, token }: DepositParams): Promise<Hex> {
  if (!ESCROW_ADDRESS) throw new DepositIntentError("unknown", "Escrow contract address is not configured.");
  const matchId = deriveMatchId(roomId);
  const erc20 = tokenAddress(token);

  try {
    if (erc20 !== NATIVE_ETH_ADDRESS) {
      const owner = await getAccount();
      await ensureAllowance(owner, erc20, wagerWei);
    }
    const hash = await writeContract(wagmiConfig, {
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: "createOpenChallenge",
      args: [matchId, erc20, wagerWei],
      value: erc20 === NATIVE_ETH_ADDRESS ? wagerWei : BigInt(0),
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    return hash;
  } catch (error) {
    throw mapWalletError(error);
  }
}

/** `acceptChallenge(matchId)` matching the creator's stake. Returns the tx hash. */
export async function acceptChallengeTx({ roomId, wagerWei, token }: DepositParams): Promise<Hex> {
  if (!ESCROW_ADDRESS) throw new DepositIntentError("unknown", "Escrow contract address is not configured.");
  const matchId = deriveMatchId(roomId);
  const erc20 = tokenAddress(token);

  try {
    if (erc20 !== NATIVE_ETH_ADDRESS) {
      const owner = await getAccount();
      await ensureAllowance(owner, erc20, wagerWei);
    }
    const hash = await writeContract(wagmiConfig, {
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: "acceptChallenge",
      args: [matchId],
      value: erc20 === NATIVE_ETH_ADDRESS ? wagerWei : BigInt(0),
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    return hash;
  } catch (error) {
    throw mapWalletError(error);
  }
}
