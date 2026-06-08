import type { Metadata } from "next";
import { BlinkChallengeAccept } from "@/components/challenge/BlinkChallengeAccept";

export const metadata: Metadata = {
  title: "CORA - Accept Challenge",
  description: "Accept a funded CORA Blink challenge.",
};

export default async function ChallengePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <BlinkChallengeAccept roomId={roomId} />;
}
