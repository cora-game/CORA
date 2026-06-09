"use client";

import { http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { CORA_ESCROW_ABI } from "@shared/escrowAbi";
import type { Address } from "viem";

/**
 * Base Sepolia + RainbowKit/wagmi config for the CORA web app.
 * Replaces the Solana ConnectionProvider/WalletProvider setup.
 */

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "") as Address;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "cora-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "CORA",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

export { CORA_ESCROW_ABI, baseSepolia };
