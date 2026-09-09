import { RoundEnding, RoundPhase, RoundRecord } from "@/utils/expedition";
import type { TFunction } from "@/i18n";
import type { Category } from "../../game/cities";
import { cx, useCountUp } from "./ui";
import { CategoryIcon, Glyph } from "./Glyph";
import { StageCall } from "./StageCall";
import StageResult, { StageAction, StageActionQuiet } from "./StageResult";

/**
 * The pieces that make a run feel like a run rather than a form: the pot you
 * are risking, the lives you are risking it with, the circle closing in, and
 * the moment the game stops and asks whether you want more.
 *
 * They live here rather than in `ExpeditionRun` because that file is already
 * the whole round loop; these are presentation, and they take their state as
 * numbers so they can be reasoned about — and restyled — on their own.
 */

/** The colour a finished round leaves on the strip, matching the share squares. */
const ENDING_FILL: Record<RoundEnding, string> = {
  banked: "bg-signal-500",
  close: "bg-beacon-500",
  bust: "bg-alert-500",
};

/**
 * One finished round in the run strip. A near miss gets its own colour rather
 * than being lumped in with a bust — the row is meant to read as a story, and
 * "three yellows" is a different story from "three reds".
 */
export const RoundPip = ({ ending }: { ending: RoundEnding }) => (
  <span
    className={cx("inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]", ENDING_FILL[ending])}
    aria-hidden
  />
);

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

/**
 * The card being dealt.
 *
 * A round starts by asking a question, and the question used to arrive as a
 * line of text in the action bar while a small card lit up in the hand. Here
 * it lands face-up on the whole screen for a beat and then gets out of the
 * way — enough to register what is being asked, not enough to become a tap.
 *
 * It holds the screen rather than flashing over it, which the multiplayer
 * board cannot do: nothing here is on a clock but the player.
 */
export const CardDraw = ({
  category,
  label,
  round,
  onDismiss,
  t,
}: {
  category: Category;
  /** The card's name, in the reader's language. */
  label: string;
  round: number;
  onDismiss: () => void;
  t: TFunction;
}) => (
  <StageCall
    mode="hold"
    label={t("expedition.round", { number: round })}
    title={label}
    prompt={t("expedition.draw.prompt")}
    onDismiss={onDismiss}
  >
    <CategoryIcon
      category={category}
      className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-beacon-300 opacity-60"
    />
    <CategoryIcon
      category={category}
      className="absolute right-2.5 bottom-2.5 h-3.5 w-3.5 rotate-180 text-beacon-300 opacity-60"
    />
    <span className="grid h-16 w-16 place-items-center rounded-full bg-chart-950/40 text-beacon-300 ring-1 ring-beacon-500/40 ring-inset">
      <CategoryIcon category={category} className="h-8 w-8" />
    </span>
  </StageCall>
);

/** How a finished round is delivered. */
const RESULT_TONE: Record<RoundEnding, "signal" | "beacon" | "alert"> = {
  banked: "signal",
  close: "beacon",
  bust: "alert",
};

/**
 * How the round went, given the screen the way the crossroads is.
 *
 * This one waits for a tap rather than timing out, because there is a real
 * decision inside it on a bust: spend the second wind, or let the life go. It
 * carries the answer as well as the verdict — being told the city you should
 * have played, and where your pick actually came, is the part of a lost round
 * worth having, and it should not be something you have to scroll for.
 */
export const RoundResult = ({
  ending,
  score,
  standing,
  lives,
  totalLives,
  category,
  label,
  answer,
  pick,
  rank,
  of,
  onSecondWind,
  onNext,
  onDismiss,
  t,
}: {
  ending: RoundEnding;
  /** What the round paid. */
  score: number;
  /** Cards that were standing on the table when it ended. */
  standing: number;
  lives: number;
  totalLives: number;
  category: Category;
  label: string;
  /** The city that was the answer, named for the reader. */
  answer: string | null;
  /** The city that was played, when it was not the answer. */
  pick: string | null;
  rank: number | null;
  of: number | null;
  /** Offered only when the bust can still be taken back. */
  onSecondWind: (() => void) | null;
  onNext: () => void;
  onDismiss: () => void;
  t: TFunction;
}) => (
  <StageResult
    tone={RESULT_TONE[ending]}
    shake={ending === "bust"}
    title={t(`expedition.result.${ending}`)}
    subtitle={
      ending === "bust"
        ? standing > 0
          ? t("expedition.result.cost")
          : // Busting on the round's first card loses a life and nothing else
            // — there was no stack for it to take.
            t("expedition.result.costLife")
        : ending === "close"
          ? // The runner-up's whole point is that it is a let-off, so the line
            // leads with the life it did not cost. On a round's first card it
            // pays nothing, and claiming otherwise would be a lie about zero.
            standing > 0
            ? t("expedition.result.kept", { count: score })
            : t("expedition.result.keptNothing")
          : t("expedition.result.paid", { count: score })
    }
    figure={Array.from({ length: totalLives }, (_, index) => (
      <Life key={index} spent={index >= lives} />
    ))}
    detail={
      <>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-chart-400 uppercase">
          <CategoryIcon category={category} className="text-beacon-500" />
          {label}
        </div>
        <div className="mt-1.5 font-display text-xl font-bold text-beacon-400">{answer ?? "—"}</div>
        {pick && (
          <p className="mt-1 text-xs text-chart-400">
            {t("expedition.result.yours", { city: pick })}
            {rank !== null && of !== null && (
              <span className="ml-1 text-chart-500">{t("expedition.rank", { rank, of })}</span>
            )}
          </p>
        )}
      </>
    }
    actions={
      <>
        {onSecondWind && (
          <StageActionQuiet onClick={onSecondWind}>
            <Glyph name="swap" /> {t("expedition.secondWind.use")}
          </StageActionQuiet>
        )}
        <StageAction onClick={onNext} wide={!onSecondWind}>
          {t("expedition.next")} <Glyph name="arrow-right" />
        </StageAction>
      </>
    }
    peek={t("expedition.result.peek")}
    onDismiss={onDismiss}
  />
);

/**
 * The end of the run, given the same screen its rounds got.
 *
 * It sits over the game-over panel rather than replacing it: the panel keeps
 * the full tally and the way back to the setup screen, and a run worth sharing
 * is worth reading twice. The pips are the figure because the row of them is
 * the run — banked, banked, runner-up, bust is a story a number is not.
 */
export const RunOver = ({
  conquered,
  summited,
  round,
  score,
  hits,
  cards,
  history,
  challenge,
  onShare,
  shareLabel,
  onAgain,
  onDismiss,
  t,
}: {
  /** The descent walked to its end — the run was won, not merely survived. */
  conquered: boolean;
  summited: boolean;
  /** How deep the run got. */
  round: number;
  score: number;
  hits: number;
  cards: number;
  history: RoundRecord[];
  /** The mark a shared link set, when this run came from one. */
  challenge: { score: number } | null;
  onShare: () => void;
  /** "Share the run", or the copied confirmation. */
  shareLabel: string;
  onAgain: () => void;
  onDismiss: () => void;
  t: TFunction;
}) => (
  <StageResult
    tone={conquered || summited ? "signal" : "beacon"}
    title={conquered ? t("expedition.conquered.title") : t("expedition.over.title")}
    subtitle={
      conquered
        ? t("expedition.conquered.reached", { round })
        : t("expedition.over.reached", { round })
    }
    figure={history.map((record) => (
      <RoundPip key={record.number} ending={record.ending} />
    ))}
    detail={
      <>
        <p className="text-sm text-chart-200">
          {t("expedition.over.score", { count: score, hits, cards })}
        </p>
        {conquered ? (
          <p className="mt-1 text-xs text-signal-400">{t("expedition.conquered.done")}</p>
        ) : (
          summited && (
            <p className="mt-1 text-xs text-signal-400">{t("expedition.summit.done")}</p>
          )
        )}
        {challenge && (
          <p className="mt-1 text-xs text-chart-300">
            {score > challenge.score
              ? t("expedition.challenge.beaten", { score: challenge.score })
              : t("expedition.challenge.missed", { score: challenge.score })}
          </p>
        )}
      </>
    }
    actions={
      <>
        <StageActionQuiet onClick={onAgain}>{t("expedition.again")}</StageActionQuiet>
        <StageAction onClick={onShare}>{shareLabel}</StageAction>
      </>
    }
    peek={t("expedition.result.peek")}
    onDismiss={onDismiss}
  />
);
