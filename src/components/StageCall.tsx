import { ReactNode } from "react";
import { cx } from "./ui";

/** How long a flash takes to fade once its caller says it is leaving. */
export const STAGE_FADE_MS = 400;

type StageTone = "beacon" | "signal" | "alert";

const TONES: Record<StageTone, { border: string; fill: string; glow: string; title: string }> = {
  // The neutral one: something is being asked, not judged.
  beacon: {
    border: "border-beacon-500/70",
    fill: "bg-beacon-500/10",
    glow: "shadow-beacon-500/20",
    title: "text-chart-100",
  },
  signal: {
    border: "border-signal-500/70",
    fill: "bg-signal-500/10",
    glow: "shadow-signal-500/20",
    title: "text-signal-400",
  },
  alert: {
    border: "border-alert-500/70",
    fill: "bg-alert-500/10",
    glow: "shadow-alert-500/20",
    title: "text-alert-500",
  },
};

/**
 * The app's "something just happened, look here" card.
 *
 * The expedition's crossroads showed that a moment given the whole screen
 * reads as a game where a line in a toolbar reads as a form, and this is that
 * moment's reusable half: an optional label, an optional card, the headline,
 * and a line saying what it means or what to do about it.
 *
 * The mode is the important part, and it is decided by whether a clock is
 * running:
 *
 * - `hold` dims the screen and waits, because nothing is moving without the
 *   player. The expedition's card draw uses it — it is turn-free and solo.
 * - `flash` draws no scrim and takes no clicks. The multiplayer board uses it
 *   for turn calls and for call/doubt verdicts, where a turn is timed and
 *   shared: a card that swallowed the tap after it, or hid the board while the
 *   clock ran, would cost somebody their turn.
 */
export const StageCall = ({
  mode,
  label,
  title,
  prompt,
  tone = "beacon",
  icon,
  shake,
  leaving,
  onDismiss,
  children,
}: {
  mode: "hold" | "flash";
  /** The small line above — the round, usually. */
  label?: string;
  /** The headline, which takes the tone's colour. */
  title: string;
  /** One line on what it means, or what to do next. */
  prompt?: ReactNode;
  tone?: StageTone;
  /** Sits inline with the headline. A verdict names its category this way. */
  icon?: ReactNode;
  /** A miss wobbles. */
  shake?: boolean;
  /** Fade out in place; the caller owns the timing. See `STAGE_FADE_MS`. */
  leaving?: boolean;
  /** Only meaningful in `hold`, where a tap can skip the wait. */
  onDismiss?: () => void;
  /** What sits on the card face: a category glyph, an avatar. Optional — a
   *  verdict is all words and wants none. */
  children?: ReactNode;
}) => {
  const hold = mode === "hold";
  const accent = TONES[tone];

  return (
    <div
      className={cx(
        "fixed inset-x-0 z-[70] flex justify-center px-6",
        hold
          ? "animate-appear inset-y-0 items-center bg-chart-950/80 backdrop-blur-sm"
          : // A quarter down, clear of the fixed bars, over the board where
            // the eye already is — and click-through.
            "pointer-events-none top-1/4",
      )}
      role={hold ? "presentation" : "status"}
      aria-live={hold ? undefined : "polite"}
      onClick={hold ? onDismiss : undefined}
    >
      {/* The shake lives on a wrapper so it composes with the card's own
          entrance instead of fighting it for the transform. */}
      <div className={cx(shake && "animate-verdict-shake")}>
        <div
          className={cx(
            "text-center transition-opacity",
            hold
              ? "animate-deal"
              : // Nothing dims behind a flash, so it carries its own surface —
                // otherwise the caption lands on top of live board copy and
                // neither can be read.
                cx("animate-pop rounded-2xl border bg-chart-950/95 px-6 py-5 shadow-2xl shadow-black/60", accent.border),
            leaving && "opacity-0",
          )}
          style={{ transitionDuration: `${STAGE_FADE_MS}ms` }}
        >
          {label && (
            <p className="text-[11px] font-semibold tracking-[0.16em] text-chart-400 uppercase">
              {label}
            </p>
          )}

          {children && (
            <div className={cx("grid place-items-center", label && "mt-3")}>
              <div
                className={cx(
                  "card-face relative grid place-items-center rounded-2xl border shadow-2xl",
                  hold ? "h-44 w-32" : "h-32 w-24",
                  accent.border,
                  accent.fill,
                  accent.glow,
                )}
              >
                {children}
              </div>
            </div>
          )}

          <p
            className={cx(
              "flex items-center justify-center gap-2 font-display font-bold",
              accent.title,
              hold ? "text-xl" : "text-lg",
              (!!label || !!children) && "mt-4",
            )}
          >
            {icon}
            {title}
          </p>
          {prompt && <div className="mt-1 text-xs text-chart-400">{prompt}</div>}
        </div>
      </div>
    </div>
  );
};

export default StageCall;
