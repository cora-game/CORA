"use client";

import Image from "next/image";

type ShareNotice = {
  text: string;
  tone: "success" | "error";
};

type ChallengeShareCardProps = {
  title: string;
  challengerAddress: string;
  arenaLabel: string;
  token: string;
  wagerUsd: string;
  challengeLink: string | null;
  description?: string | null;
  statusLabel: string;
  eyebrowLabel?: string;
  characterExpressionSrc?: string | null;
  characterExpressionAlt?: string;
  showCharacterPortrait?: boolean;
};

type ChallengeShareActionsProps = {
  challengeLink: string | null;
  notice: ShareNotice | null;
  actionCopyLabel?: string;
  actionSaveLabel?: string;
  actionShareLabel?: string;
  onCopy: () => void;
  onSaveJpg: () => void;
  onShareX: () => void;
};

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function ChallengeShareCard({
  title,
  challengerAddress,
  arenaLabel,
  token,
  wagerUsd,
  challengeLink,
  description,
  statusLabel,
  eyebrowLabel = "Cora Challenge",
  characterExpressionSrc,
  characterExpressionAlt = "Challenge character expression",
  showCharacterPortrait = true,
}: ChallengeShareCardProps) {
  const shortWallet = shortenAddress(challengerAddress);
  const qrSrc = challengeLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(challengeLink)}`
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-[26px] border p-4 shadow-[0_16px_40px_rgba(20,20,20,0.18)] md:p-5"
      style={{
        borderColor: "rgba(55,55,55,0.22)",
        background: "linear-gradient(165deg, #fffcf6 0%, #f3ecdd 58%, #ede5d4 100%)",
      }}
    >
      <div className="rounded-[20px] border border-[rgba(34,34,34,0.2)] bg-[rgba(255,252,246,0.7)] p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-2xl border border-[rgba(34,34,34,0.16)] bg-[linear-gradient(155deg,#fffaf0_0%,#f3ead8_100%)] p-4">
            <div className={`relative grid gap-4 ${showCharacterPortrait ? "sm:grid-cols-[164px_1fr] sm:items-center" : ""}`}>
              {showCharacterPortrait ? (
                <div className="flex justify-center sm:justify-start">
                  <div className="relative h-[154px] w-[154px] overflow-hidden rounded-[28px] border border-[rgba(111,58,40,0.18)] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.92),rgba(250,239,216,0.8)_45%,rgba(226,211,181,0.86)_100%)] shadow-[0_18px_36px_rgba(77,42,24,0.16)]">
                    {characterExpressionSrc ? (
                      <Image
                        src={characterExpressionSrc}
                        alt={characterExpressionAlt}
                        fill
                        sizes="154px"
                        className="object-cover object-center"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <span className="font-caprasimo text-5xl text-[rgba(44,39,36,0.72)]">{shortenAddress(challengerAddress).slice(0, 1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="relative min-w-0">
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.22em] text-[rgba(34,34,34,0.6)]">
                  {eyebrowLabel}
                </p>
                <p className={`mt-2 text-balance font-caprasimo text-3xl leading-[0.9] text-[#1f1b18] md:text-5xl ${showCharacterPortrait ? "max-w-[11ch]" : "max-w-[14ch]"}`}>
                  {title}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[rgba(34,34,34,0.2)] bg-[rgba(255,255,255,0.72)] px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[#25211d]">
                    {statusLabel}
                  </span>
                  <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(34,34,34,0.16)] bg-[rgba(255,255,255,0.52)] px-3 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(40,36,33,0.64)]">
                    <span>Wallet</span>
                    <span className="truncate font-mono text-[11px] normal-case tracking-normal text-[rgba(44,39,36,0.82)]">
                      {shortWallet}
                    </span>
                  </span>
                </div>

                {description ? (
                  <p className="mt-4 max-w-xl font-gabarito text-sm leading-relaxed text-[rgba(44,39,36,0.82)]">{description}</p>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-[rgba(34,34,34,0.16)] bg-[linear-gradient(155deg,#f8f2e6_0%,#eee4d2_100%)] p-4">
            <div className="rounded-xl border border-[rgba(34,34,34,0.18)] bg-[rgba(255,255,255,0.72)] p-2">
              <div className="grid min-h-[154px] place-items-center rounded-lg border border-[rgba(34,34,34,0.14)] bg-[#f3ecdc] p-2">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc} alt="Challenge QR code" width={140} height={140} className="rounded-sm" />
                ) : (
                  <p className="font-gabarito text-xs text-[rgba(40,36,33,0.62)]">QR unavailable</p>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Token</p>
                  <p className="truncate font-gabarito text-xs font-bold uppercase tracking-[0.05em] text-[#1f1b18]">{token}</p>
                </div>
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Wager</p>
                  <p className="truncate font-gabarito text-xs font-bold text-[#1f1b18]">${wagerUsd}</p>
                </div>
                <div className="grid grid-cols-[68px_1fr] items-center gap-2 rounded-md border border-[rgba(34,34,34,0.14)] bg-[rgba(255,255,255,0.72)] px-2 py-1.5">
                  <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(40,36,33,0.64)]">Arena</p>
                  <p className="truncate font-gabarito text-xs font-bold text-[#1f1b18]">{arenaLabel}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function ChallengeShareActions({
  challengeLink,
  notice,
  actionCopyLabel = "Copy Link",
  actionSaveLabel = "Save As JPG",
  actionShareLabel = "Share On X",
  onCopy,
  onSaveJpg,
  onShareX,
}: ChallengeShareActionsProps) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionCopyLabel}
        </button>
        <button
          type="button"
          onClick={onSaveJpg}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionSaveLabel}
        </button>
        <button
          type="button"
          onClick={onShareX}
          className="rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
          style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
        >
          {actionShareLabel}
        </button>
      </div>

      {notice && (
        <p className="mt-2 font-gabarito text-xs" style={{ color: notice.tone === "success" ? "#2f6249" : "#8a3f2b" }}>
          {notice.text}
        </p>
      )}

      {challengeLink && (
        <p className="mt-2 break-all font-mono text-[11px] text-[rgba(44,39,36,0.72)]">
          {challengeLink}
        </p>
      )}
    </div>
  );
}
