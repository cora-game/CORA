"use client";

import { useEffect } from "react";
import { WagmiProvider, useAccount, useChainId, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { wagmiConfig, baseSepolia } from "@/lib/evm/config";

const queryClient = new QueryClient();

/**
 * Keeps the connected wallet on Base Sepolia. If the user is connected to any
 * other network, request a switch automatically (RainbowKit also surfaces a
 * "Wrong network" button as a fallback if the wallet rejects the switch).
 */
function AutoSwitchToBaseSepolia() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (isConnected && chainId !== baseSepolia.id) {
      try {
        switchChain({ chainId: baseSepolia.id });
      } catch {
        // Wallet may reject or not support programmatic switching — the
        // RainbowKit "Wrong network" button remains available.
      }
    }
  }, [isConnected, chainId, switchChain]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} modalSize="compact" initialChain={baseSepolia}>
          <AutoSwitchToBaseSepolia />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
