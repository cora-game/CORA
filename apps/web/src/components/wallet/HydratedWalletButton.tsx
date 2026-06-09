"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

type HydratedWalletButtonProps = {
  className?: string;
};

/**
 * Wallet connect button. RainbowKit's ConnectButton handles connect/disconnect,
 * network switching, and the wallet modal (MetaMask / Coinbase Wallet / WalletConnect).
 */
export function HydratedWalletButton({ className }: HydratedWalletButtonProps) {
  return (
    <div className={className}>
      <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
    </div>
  );
}
