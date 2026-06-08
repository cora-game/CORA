export type BattleUiAlert = {
  id: string;
  title: string;
  message: string;
  tone: "error" | "warning";
  autoDismissMs: number;
  actionLabel?: string;
  onAction?: () => void;
};

type BattleScreenStatusLayerProps = {
  visibleAlerts: BattleUiAlert[];
  socketUrl: string | null;
  onDismissAlert: (alertId: string) => void;
};

export function BattleScreenStatusLayer({
  visibleAlerts,
  socketUrl,
  onDismissAlert,
}: BattleScreenStatusLayerProps) {
  return (
    <div className="battle-alert-layer fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2 md:right-6 md:top-6">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="battle-alert-card frame-cut px-3 py-2"
          style={{
            border:
              alert.tone === "error"
                ? "1px solid rgba(186,105,49,0.42)"
                : "1px solid rgba(248,214,148,0.42)",
            background:
              alert.tone === "error"
                ? "rgba(43,24,16,0.94)"
                : "rgba(13,24,20,0.94)",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className="battle-alert-title font-gabarito text-xs font-bold uppercase tracking-wide"
              style={{ color: alert.tone === "error" ? "#f8d694" : "#f8d694" }}
            >
              {alert.title}
            </p>
            <button
              type="button"
              onClick={() => onDismissAlert(alert.id)}
              className="battle-alert-close font-gabarito text-xs font-bold leading-none text-[var(--tone-cream)] opacity-80"
              aria-label="Close alert"
            >
              X
            </button>
          </div>
          <p
            className="battle-alert-message mt-1 break-words font-gabarito text-xs"
            style={{ color: "rgba(244,240,230,0.88)" }}
          >
            {alert.message}
          </p>
          {alert.id.startsWith("socket:") && socketUrl && (
            <p className="battle-alert-url mt-1 break-all font-gabarito text-[11px] text-[rgba(244,240,230,0.74)]">
              {socketUrl}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {alert.actionLabel && alert.onAction && (
              <button
                type="button"
                onClick={alert.onAction}
                className="battle-alert-action frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{
                  border: "1px solid rgba(248,214,148,0.35)",
                  color: "var(--tone-cream)",
                  background: "rgba(19,32,26,0.9)",
                }}
              >
                {alert.actionLabel}
              </button>
            )}
          </div>
          <div className="battle-alert-drain mt-2 h-1 overflow-hidden rounded-full bg-[rgba(248,214,148,0.16)]">
            <div
              className="h-full"
              style={{
                width: "100%",
                background:
                  alert.tone === "error"
                    ? "linear-gradient(90deg,#d9a85b,#ba6931)"
                    : "linear-gradient(90deg,#d9a85b,#ba6931)",
                animationName: alert.autoDismissMs > 0 ? "alertDrain" : undefined,
                animationDuration: alert.autoDismissMs > 0 ? `${alert.autoDismissMs}ms` : undefined,
                animationTimingFunction: alert.autoDismissMs > 0 ? "linear" : undefined,
                animationFillMode: alert.autoDismissMs > 0 ? "forwards" : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
