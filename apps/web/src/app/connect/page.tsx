import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectWalletScreen } from "@/components/connect/ConnectWalletScreen";

export const metadata: Metadata = {
  title: "CORA - Connect Wallet",
  description: "Connect a wallet for wager matches or enter practice without one.",
};

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectWalletScreen />
    </Suspense>
  );
}
