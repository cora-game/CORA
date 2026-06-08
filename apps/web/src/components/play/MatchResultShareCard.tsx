"use client";

import Image from "next/image";

type MatchResultShareCardProps = {
  title: string;
  arenaLabel: string;
  wagerUsd: string;
  playerCharacterName: string;
  opponentCharacterName: string;
  playerAddressLabel: string;
  opponentAddressLabel: string;
  playerExpressionSrc?: string | null;
  opponentExpressionSrc?: string | null;
  roundsLabel: string;
  correctCount: number;
  wrongCount: number;
  timeoutCount: number;
};

function PortraitCard({
  label,
  characterName,
  addressLabel,
  expressionSrc,
  fallback,
}: {
  label: string;
  characterName: string;
  addressLabel: string;
  expressionSrc?: string | null;
  fallback: string;
}) {
  return (
    <div className="rounded-[22px] border border-[rgba(34,34,34,0.16)] bg-[linear-gradient(155deg,#fffaf0_0%,#f3ead8_100%)] p-3">
      <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.16em] text-[rgba(34,34,34,0.56)]">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-20 w-20 overflow-hidden rounded-[20px] border border-[rgba(111,58,40,0.16)] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.9),rgba(248,236,212,0.84)_45%,rgba(226,211,181,0.88)_100%)] shadow-[0_10px_18px_rgba(77,42,24,0.14)]">
          {expressionSrc ? (
            <Image src={expressionSrc} alt={`${characterName} expression`} fill sizes="80px" className="object-cover object-center" />
          ) : (
            <div className="grid h-full place-items-center">
              <span className="font-caprasimo text-3xl text-[rgba(44,39,36,0.72)]">{fallback}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-caprasimo text-2xl leading-none text-[#1f1b18]">{characterName}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-[rgba(44,39,36,0.68)]">{addressLabel}</p>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-3 py-2">
      <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">{label}</p>
      <p className="mt-1 font-gabarito text-sm font-black text-[#1f1b18]">{value}</p>
    </div>
  );
}

export function MatchResultShareCard({
  title,
  arenaLabel,
  wagerUsd,
  playerCharacterName,
  opponentCharacterName,
  playerAddressLabel,
  opponentAddressLabel,
  playerExpressionSrc,
  opponentExpressionSrc,
  roundsLabel,
  correctCount,
  wrongCount,
  timeoutCount,
}: MatchResultShareCardProps) {
  return (
    <div
      className="overflow-hidden rounded-[26px] border p-4 shadow-[0_16px_40px_rgba(20,20,20,0.18)] md:p-5"
      style={{
        borderColor: "rgba(55,55,55,0.22)",
        background: "linear-gradient(165deg, #fffcf6 0%, #f3ecdd 58%, #ede5d4 100%)",
      }}
    >
      <div className="rounded-[20px] border border-[rgba(34,34,34,0.2)] bg-[rgba(255,252,246,0.74)] p-4 md:p-5">
        <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.22em] text-[rgba(34,34,34,0.6)]">Cora Match Result</p>
        <p className="mt-2 w-full max-w-none text-balance font-caprasimo text-[2.35rem] leading-[0.92] text-[#1f1b18] md:text-[3.8rem]">
          {title}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <PortraitCard
            label="Your Scientist"
            characterName={playerCharacterName}
            addressLabel={playerAddressLabel}
            expressionSrc={playerExpressionSrc}
            fallback={playerCharacterName.slice(0, 1)}
          />
          <PortraitCard
            label="Rival Scientist"
            characterName={opponentCharacterName}
            addressLabel={opponentAddressLabel}
            expressionSrc={opponentExpressionSrc}
            fallback={opponentCharacterName.slice(0, 1)}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <StatPill label="Arena" value={arenaLabel} />
          <StatPill label="Wager" value={`$${wagerUsd}`} />
          <StatPill label="Rounds" value={roundsLabel} />
          <StatPill label="Correct" value={`${correctCount}`} />
          <StatPill label="Wrong / Timeout" value={`${wrongCount} / ${timeoutCount}`} />
        </div>
      </div>
    </div>
  );
}
