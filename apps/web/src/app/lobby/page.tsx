import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyScreen } from "../../components/lobby/LobbyScreen";

export const metadata: Metadata = {
  title: "CORA - Enter the Arena",
  description: "Set your arena, pick your champion, and enter matchmaking.",
};

export default function LobbyPage() {
  return (
    <Suspense fallback={null}>
      <LobbyScreen />
    </Suspense>
  );
}
