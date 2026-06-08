import { Suspense } from "react";
import { BattleScreen } from "@/components/play/BattleScreen";

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <BattleScreen />
    </Suspense>
  );
}
