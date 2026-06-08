"use client";

import dynamic from "next/dynamic";

type HydratedWalletButtonProps = {
  className?: string;
};

const ClientWalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        disabled
        className="wallet-adapter-button wallet-adapter-button-trigger"
      >
        Connect Wallet
      </button>
    ),
  },
);

export function HydratedWalletButton({ className }: HydratedWalletButtonProps) {
  return <ClientWalletMultiButton className={className} />;
}
