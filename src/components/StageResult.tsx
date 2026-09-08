import { ReactNode } from "react";
import { cx } from "./ui";
import { Glyph } from "./Glyph";

type ResultTone = "signal" | "beacon" | "alert";

const TONES: Record<ResultTone, { title: string; border: string }> = {
  signal: { title: "text-signal-400", border: "border-signal-500/50" },
  beacon: { title: "text-beacon-400", border: "border-beacon-500/50" },
  alert: { title: "text-alert-500", border: "border-alert-500/50" },
};

/**
 * "Here is how that went, now choose" — the other half of the overlay
 * language, and the counterpart to `StageCall`.
 *
 * A `StageCall` is over in a second and asks nothing; this waits, because
 * every screen built on it ends in a decision the player has to make. It is
 * bottom-anchored on a phone so the buttons land under a thumb, and the scrim
 * steps aside on a tap so the board underneath can still be studied — a
 * result you cannot look past is a result you cannot learn from.
 */
export const StageResult = ({
  tone,
  title,
  subtitle,
  figure,
  detail,
  actions,
  peek,
  shake,
  onDismiss,
}: {
  tone: ResultTone;
  title: string;
  /** One line under the headline: what it paid, what it cost. */
  subtitle?: ReactNode;
  /** The row under that — lives left, the day's marks. */
  figure?: ReactNode;
  /** The block worth keeping: the answer, the tally. */
  detail?: ReactNode;
  /** The buttons. Laid out by the caller, since only it knows how many. */
  actions: ReactNode;
  peek: string;
  shake?: boolean;
  onDismiss: () => void;
}) => {
  const accent = TONES[tone];

  return (
    <div
      className="animate-appear fixed inset-0 z-[60] flex flex-col justify-end bg-chart-950/70 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onDismiss}
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="animate-rise w-full sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <p
            className={cx(
              "font-display text-2xl font-bold sm:text-3xl",
              accent.title,
              shake && "animate-verdict-shake",
            )}
          >
            {title}
          </p>
          {subtitle && <div className="mt-1 text-sm text-chart-300">{subtitle}</div>}
          {figure && <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">{figure}</div>}
        </div>

        {detail && (
          <div className={cx("mt-5 rounded-2xl border bg-chart-900/80 p-4", accent.border)}>
            {detail}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">{actions}</div>

        <p className="mt-3 text-center text-[11px] text-chart-500">
          <Glyph name="compass" /> {peek}
        </p>
      </div>
    </div>
  );
};

/** The loud button a result ends on — next round, share the day. */
export const StageAction = ({
  onClick,
  children,
  wide,
}: {
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) => (
  <button
    type="button"
    autoFocus
    onClick={onClick}
    className={cx(
      "min-h-14 rounded-2xl border border-beacon-500 bg-beacon-500 px-4 py-3 font-display text-sm font-bold text-chart-950 shadow-lg shadow-beacon-500/20 transition-all hover:bg-beacon-400 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beacon-300",
      wide && "sm:col-span-2",
    )}
  >
    {children}
  </button>
);

/** The quiet one beside it — a second wind, a look at the archive. */
export const StageActionQuiet = ({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-14 rounded-2xl border border-signal-500/50 bg-signal-500/10 px-4 py-3 font-display text-sm font-bold text-signal-400 transition-all hover:border-signal-500 hover:bg-signal-500/20 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500"
  >
    {children}
  </button>
);

export default StageResult;
