import { RoundEnding, RoundPhase } from "@/utils/expedition";
import type { TFunction } from "@/i18n";
import { cx, useCountUp } from "./ui";
import { Glyph } from "./Glyph";

/**
 * The pieces that make a run feel like a run rather than a form: the pot you
 * are risking, the lives you are risking it with, the circle closing in, and
 * the moment the game stops and asks whether you want more.
 *
 * They live here rather than in `ExpeditionRun` because that file is already
 * the whole round loop; these are presentation, and they take their state as
 * numbers so they can be reasoned about — and restyled — on their own.
 */

/**
 * One chip on the table. The stack heats as it grows — pale amber for the
 * first card, alert red once the stack is big enough that losing it would
 * hurt — so the temptation to push is visible before it is read.
 */
const CHIP_HEAT = ["bg-beacon-300", "bg-beacon-400", "bg-beacon-500", "bg-alert-500"];

const chipHeat = (index: number): string => CHIP_HEAT[Math.min(index, CHIP_HEAT.length - 1)];

/** Chips grow with the stack, so a long streak is a taller silhouette. The cap
 *  keeps the tallest stack inside the strip on a phone. */
const chipHeight = (index: number): number => Math.min(14 + index * 6, 44);

const Chip = ({ index, ghost }: { index: number; ghost?: boolean }) => (
  <span
    className={cx(
      "inline-block w-3 rounded-[3px] transition-all duration-300",
      ghost ? "border border-dashed border-beacon-500/50" : chipHeat(index),
      !ghost && "animate-pop",
    )}
    style={{ height: chipHeight(index) }}
    aria-hidden
  />
);

/**
 * The pot: what is on the table right now, drawn as a stack that grows rather
 * than a number in a button label. The dashed chip on the end is what one more
 * card would add — the whole argument for pushing, in one shape.
 */
export const PotStage = ({
  streak,
  pot,
  next,
  phase,
  ending,
  gain,
  t,
}: {
  /** Cards standing on the table. */
  streak: number;
  /** What walking away is worth. */
  pot: number;
  /** What the card in play — or the next one — is worth, if there is one. */
  next: number | null;
  /** Where the round is, which decides what the stack has to say for itself. */
  phase: RoundPhase;
  /** How the round ended, once it has. */
  ending: RoundEnding | null;
  /** The last card's winnings, floated off the stack when it lands. */
  gain: { value: number; key: number } | null;
  t: TFunction;
}) => {
  const shown = useCountUp(pot);
  const busted = ending === "bust";
  const kept = ending === "banked" || ending === "close";
  // Busting on the round's first card costs a life but no stack — striking a
  // zero through would claim a loss that never happened.
  const lostNothing = busted && streak === 0;

  return (
    <section className="panel relative overflow-hidden px-3 py-2.5 sm:px-5 sm:py-4">
      {/* A faint heat wash behind a stack worth losing. */}
      {streak >= 3 && !busted && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 100% 0%, color-mix(in oklab, var(--color-beacon-500) 12%, transparent), transparent 60%)",
          }}
        />
      )}

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-chart-500 uppercase">
            {t("expedition.pot")}
          </div>

          <div className="relative inline-flex items-baseline gap-1.5">
            <span
              className={cx(
                "font-display text-3xl font-bold tabular-nums transition-colors sm:text-5xl",
                busted
                  ? lostNothing
                    ? "text-chart-600"
                    : "text-alert-500/70 line-through"
                  : kept
                    ? "text-signal-400"
                    : "text-chart-100",
              )}
            >
              {shown}
            </span>
            <span className="text-xs text-chart-500">{t("expedition.pts")}</span>

            {gain && (
              <span
                key={gain.key}
                aria-hidden
                className="animate-float-up absolute -top-1 -right-6 font-display text-lg font-bold text-signal-400"
              >
                +{gain.value}
              </span>
            )}
          </div>

          <p
            className={cx(
              "mt-0.5 truncate text-[11px] sm:text-xs",
              busted ? "text-alert-500" : next !== null ? "text-chart-400" : "text-chart-500",
            )}
          >
            {busted
              ? lostNothing
                ? t("expedition.endedBust")
                : t("expedition.pot.lost")
              : kept
                ? t("expedition.pot.kept")
                : streak === 0
                  ? t("expedition.pot.empty")
                  : phase === "placing"
                    ? t("expedition.pot.risk")
                    : next !== null
                      ? t("expedition.pot.next", { value: next })
                      : t("expedition.pushEmpty")}
          </p>
        </div>

        <div className={cx("flex shrink-0 items-end gap-1 sm:gap-1.5", busted && "animate-float-up")}>
          {Array.from({ length: streak }, (_, index) => (
            <Chip key={index} index={index} />
          ))}
          {phase !== "ended" && next !== null && <Chip index={streak} ghost />}
        </div>
      </div>
    </section>
  );
};

/**
 * One life. Big enough to notice going out: the daily's marks are information,
 * but this is the thing standing between the run and the end of it.
 */
export const Life = ({ spent }: { spent: boolean }) => (
  <span
    className={cx(
      "inline-block h-3.5 w-3.5 shrink-0 rounded-[4px] transition-all duration-300",
      spent ? "scale-90 bg-chart-800" : "animate-pop bg-alert-500 shadow-[0_0_10px_-1px_var(--color-alert-500)]",
    )}
    aria-hidden
  />
);

export const LifeRow = ({
  lives,
  total,
  label,
}: {
  lives: number;
  total: number;
  label: string;
}) => (
  <span className="flex items-center gap-1.5" role="img" aria-label={label}>
    {Array.from({ length: total }, (_, index) => (
      <Life key={index} spent={index >= lives} />
    ))}
  </span>
);

/**
 * The climb, drawn without giving anything away.
 *
 * The arc is how far the run is from the summit; the disc at the centre is the
 * circle the board is drawn from, shrinking round by round. Deliberately
 * abstract — the board's geography stays hidden until the round is over, so
 * this shows the noose tightening without showing a single city.
 */
export const ClimbDial = ({
  round,
  summitAt,
  radius,
  startRadius,
  summited,
  label,
}: {
  round: number;
  summitAt: number;
  radius: number;
  startRadius: number;
  summited: boolean;
  label: string;
}) => {
  const RING = 15;
  const CIRCUMFERENCE = 2 * Math.PI * RING;

  const progress = summited
    ? 1
    : Math.min(1, Math.max(0, (round - 1) / Math.max(1, summitAt - 1)));
  // The board's circle as a fraction of the one round one was drawn from.
  const tightness = Math.min(1, Math.max(0, radius / Math.max(1, startRadius)));
  const disc = 3 + tightness * 9;
  const tint = summited ? "var(--color-signal-500)" : "var(--color-beacon-500)";

  return (
    <svg
      viewBox="0 0 40 40"
      className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <circle cx="20" cy="20" r={RING} fill="none" stroke="var(--color-chart-800)" strokeWidth="3" />
      <circle
        cx="20"
        cy="20"
        r={RING}
        fill="none"
        stroke={tint}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${progress * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dasharray 600ms ease-out, stroke 400ms" }}
      />
      <circle
        cx="20"
        cy="20"
        r={disc}
        fill={`color-mix(in oklab, ${tint} 18%, transparent)`}
        stroke={tint}
        strokeWidth="1.5"
        style={{ transition: "r 600ms ease-out" }}
      />
    </svg>
  );
};

/**
 * The crossroads, given the screen.
 *
 * This is the only question the mode asks, and it used to be two pills in a
 * toolbar. Banking is the calm option and stays calm; pushing is drawn to
 * tempt, because the whole round is built to tempt you into it. The scrim is
 * dismissible — the choice stays in the action bar underneath — so nobody is
 * trapped in a modal mid-run.
 */
export const Crossroads = ({
  pot,
  next,
  streak,
  onBank,
  onPush,
  onDismiss,
  t,
}: {
  pot: number;
  next: number | null;
  streak: number;
  onBank: () => void;
  onPush: () => void;
  onDismiss: () => void;
  t: TFunction;
}) => (
  <div
    className="animate-appear fixed inset-0 z-[60] flex flex-col justify-end bg-chart-950/85 p-4 backdrop-blur-sm sm:justify-center sm:items-center"
    role="dialog"
    aria-modal="true"
    aria-label={t("expedition.crossroads.title")}
    onClick={onDismiss}
    style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
  >
    <div
      className="animate-rise w-full sm:max-w-lg"
      // The panel is the decision; only the scrim around it steps aside.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="text-center">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-chart-400 uppercase">
          {t("expedition.crossroads.title")}
        </p>
        <div className="mt-1 font-display text-6xl font-bold text-chart-100 tabular-nums sm:text-7xl">
          {pot}
        </div>
        <p className="mt-1 text-xs text-chart-400">
          {t("expedition.crossroads.onTable", { count: streak })}
        </p>
      </div>

      {/* Two thumbs' width apart and the same size as each other: the choice is
          symmetric, so neither option can be taken by accident on a phone. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          autoFocus
          onClick={onBank}
          className="min-h-24 rounded-2xl border border-signal-500/50 bg-signal-500/10 p-4 text-left transition-all hover:border-signal-500 hover:bg-signal-500/20 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500"
        >
          <div className="font-display text-base font-bold text-signal-400 sm:text-lg">
            {t("expedition.crossroads.bank")}
          </div>
          <div className="mt-1 text-[11px] text-chart-400 sm:text-xs">
            {t("expedition.crossroads.safe")}
          </div>
        </button>

        {next !== null ? (
          <button
            type="button"
            onClick={onPush}
            className="animate-pulse-ring min-h-24 rounded-2xl border border-beacon-500 bg-beacon-500 p-4 text-left transition-all hover:bg-beacon-400 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beacon-300"
          >
            <div className="font-display text-base font-bold text-chart-950 sm:text-lg">
              {t("expedition.push", { value: next })}
            </div>
            <div className="mt-1 text-[11px] font-medium text-chart-950/70 sm:text-xs">
              {t("expedition.crossroads.risk")}
            </div>
          </button>
        ) : (
          <div className="grid min-h-24 place-items-center rounded-2xl border border-chart-700 bg-chart-900 p-4 text-center">
            <span className="font-display text-sm font-bold text-chart-400">
              {t("expedition.pushEmpty")}
            </span>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-chart-500">
        <Glyph name="compass" /> {t("expedition.crossroads.peek")}
      </p>
    </div>
  </div>
);
