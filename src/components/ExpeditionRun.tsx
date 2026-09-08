import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Category,
  City,
  cityName,
  formatCoordinate,
  formatPopulation,
  missOf,
} from "../../game/cities";
import {
  bankRound,
  canCompass,
  canPush,
  canSecondWind,
  COMPASS_STRIKES,
  cardInPlay,
  cardVerdict,
  Challenge,
  EXPEDITION_LIVES,
  ExpeditionConfig,
  ExpeditionRun as Run,
  lastCard,
  loadExpeditionStats,
  nextRound,
  pushLuck,
  pushValue,
  recordRun,
  RoundEnding,
  roundFor,
  roundScore,
  roundsReached,
  saveExpeditionStats,
  settleCard,
  shareText,
  startRun,
  spendCompass,
  spendSecondWind,
} from "@/utils/expedition";
import { Mark } from "@/utils/daily";
import { shareOrCopy } from "@/utils";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSound } from "@/hooks/useSound";
import { useLocale } from "@/i18n";
import { Badge, Button, Panel, cx } from "./ui";
import { useFixedTopBar } from "./Layout";
import { MARK_STYLE, MarkSquare } from "./MarkSquare";
import { CategoryIcon, Glyph } from "./Glyph";
import CategoryCard from "./CategoryCard";
import MiniMap from "./MiniMap";
import Confetti from "./Confetti";
import { regionLabel } from "./ExpeditionSetup";

/**
 * One life, drawn rather than typed. The heart emoji has no Twemoji file in
 * `public/emoji/`, and the system one differs enough between platforms that a
 * row of them would not read as a row — the same reason the daily draws its
 * result squares (see `MarkSquare`).
 */
const Life = ({ spent }: { spent: boolean }) => (
  <span
    className={cx(
      "inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
      spent ? "bg-chart-700" : "bg-alert-500",
    )}
    aria-hidden
  />
);

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
const RoundPip = ({ ending }: { ending: RoundEnding }) => (
  <span
    className={cx("inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]", ENDING_FILL[ending])}
    aria-hidden
  />
);

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex-1 text-center">
    <div className="font-display text-xl font-bold text-chart-100 tabular-nums">{value}</div>
    <div className="text-[10px] tracking-[0.12em] text-chart-500 uppercase">{label}</div>
  </div>
);

interface ExpeditionRunProps {
  pool: City[];
  /** Round one's radius for this pool, computed once by the parent. */
  startRadius: number;
  seed: string;
  config: ExpeditionConfig;
  /** A run picked up from storage, rather than started fresh. */
  restored?: Run | null;
  /** The result carried in on a shared link, if this run came from one. */
  challenge?: Challenge | null;
  /** Start over with the same settings. */
  onRestart: () => void;
  /** Back to the setup screen. */
  onReconfigure: () => void;
}

/**
 * A run in progress.
 *
 * A round deals one card. Place it and turn it over: get it wrong and the round
 * is done, but get it right and the board asks the only question that matters —
 * bank what you have, or draw another card off the same eight cities for more
 * than the last one was worth. That is the whole mode: not whether you know the
 * card, but how many you will stake on knowing the next one.
 *
 * The board is rebuilt from the seed and the round number rather than stored, so
 * a reload picks the run up exactly where it was.
 */
const ExpeditionRun = ({
  pool,
  startRadius,
  seed,
  config,
  restored,
  challenge,
  onRestart,
  onReconfigure,
}: ExpeditionRunProps) => {
  const { locale, t } = useLocale();
  const { play } = useSound();
  useFixedTopBar();

  const [run, setRun] = useState<Run>(() => restored ?? startRun(seed, config, startRadius));
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  // A round in play is worth keeping the screen awake for; a finished run is not.
  useWakeLock(!run.over);

  const round = useMemo(
    () => roundFor(pool, startRadius, config, run.seed, run.round),
    [pool, startRadius, config, run.seed, run.round],
  );

  const label = regionLabel(config.region, t);
  const total = config.categories.length;

  const inPlay = cardInPlay(run);
  const shown = lastCard(run);
  const placing = run.phase === "placing";
  const crossroads = run.phase === "crossroads";
  const ended = run.phase === "ended";
  const ready = !!inPlay && !!run.picks[inPlay];

  /** The cards already turned over this round, oldest first. */
  const settledCards = useMemo(() => run.draws.slice(0, run.settled), [run.draws, run.settled]);
  const streak = run.settled;
  /** What walking away is worth right now, and what one more card would add. */
  const banked = roundScore(streak);
  const stake = pushValue(streak);
  const pushable = canPush(run);
  const compassReady = canCompass(run);
  const secondWindReady = canSecondWind(run);

  // Once the round is settled the stack is no longer the story: a bust took it
  // all and a near miss kept only what was standing before the last card. The
  // finished round's own record is the only honest source for both numbers.
  const record = run.history[run.history.length - 1];
  const onTable = ended ? (record?.hits ?? 0) : streak;
  const worth = ended ? (record?.score ?? 0) : banked;

  // The run is the only thing worth persisting: the boards come back from the
  // seed. A finished run is folded into the record and stops being active.
  useEffect(() => {
    const stats = loadExpeditionStats();
    saveExpeditionStats(run.over ? recordRun(stats, run) : { ...stats, active: run });
  }, [run]);

  // The summit is the run's finish line, and it deserves to land once rather
  // than every render that follows it.
  const sawSummit = useRef(run.summited);
  useEffect(() => {
    if (run.summited && !sawSummit.current) {
      sawSummit.current = true;
      play("fanfare");
      setCelebrate((count) => count + 1);
    }
  }, [run.summited, play]);

  const assign = (cityId: string) => {
    if (!inPlay) return;
    const card = inPlay;
    setRun((current) => ({ ...current, picks: { ...current.picks, [card]: cityId } }));
    play("flip");
  };

  const settle = () => {
    if (!ready) return;
    const next = settleCard(run, round);
    setRun(next);

    if (next.over) play("fanfare");
    else if (next.phase === "crossroads") play("chime");
    else play(next.ending === "close" ? "flip" : "buzz");
  };

  const bank = () => {
    const next = bankRound(run);
    setRun(next);
    play("chime");
    // A round worth walking away from is worth a bit of noise. Confetti skips
    // itself under reduced motion, so no guard is needed here.
    if (streak >= 3) setCelebrate((count) => count + 1);
  };

  const push = () => {
    setRun((current) => pushLuck(current));
    play("flip");
  };

  const compass = () => {
    setRun((current) => spendCompass(current, round));
    play("chime");
  };

  const secondWind = () => {
    setRun((current) => spendSecondWind(current));
    play("chime");
  };

  const advance = () => setRun((current) => nextRound(current));

  const share = async () => {
    const origin =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
    // The link is part of the text, so this goes out as one block rather than a
    // separate `url` a share target might render twice.
    const outcome = await shareOrCopy({ text: shareText(run, label, origin) });
    if (outcome === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
    }
  };

  const legend = (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {(["hit", "close", "miss"] as Mark[]).map((mark) => (
        <span key={mark} className="inline-flex items-center gap-1.5">
          <MarkSquare mark={mark} />
          {t(`daily.legend.${mark}`)}
        </span>
      ))}
    </span>
  );

  /** Which cities are the answer to a card already turned over this round. */
  const highlights = settledCards.reduce<Record<string, Category[]>>((map, category) => {
    const answer = round.answers[category];
    if (!answer) return map;
    map[answer.id] = [...(map[answer.id] ?? []), category];
    return map;
  }, {});

  // Keyed on the ending rather than tested for one, so a new ending has to be
  // given words here instead of quietly inheriting the message for a bust —
  // which is exactly how banking a correct card came to say "wrong city".
  const ENDING_BANNER: Record<RoundEnding, string> = {
    banked: t("expedition.endedBanked", { count: worth }),
    close: t("expedition.endedClose", { count: worth }),
    bust: t("expedition.endedBust"),
  };

  const banner = run.over
    ? t("expedition.over.title")
    : crossroads
      ? t("expedition.crossroads", { score: banked })
      : ended && run.ending
        ? ENDING_BANNER[run.ending]
        : inPlay
          ? ready
            ? t("expedition.hand.ready", { card: t(`card.${inPlay}.short`) })
            : t("expedition.hand.placeOne", { card: t(`card.${inPlay}.short`) })
          : t("expedition.hand.place", { count: total });

  /** Past the summit the board is capped at ever smaller cities; say so. */
  const beyond =
    round.popCeiling !== null
      ? t("expedition.beyond", { pop: formatPopulation(round.popCeiling) })
      : null;

  const toSummit = Math.max(0, run.summitAt - run.round);

  return (
    <>
      {celebrate > 0 && <Confetti trigger={celebrate} />}

      {/* Status banner — fixed at the top, mirroring the board and the daily. */}
      <div
        className="fixed inset-x-0 top-0 z-40 border-b border-chart-700 bg-chart-950/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              aria-label={t("expedition.back")}
              className="tap-target grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-chart-700 text-sm text-chart-400 transition-colors hover:bg-chart-800 hover:text-chart-200"
            >
              <Glyph name="arrow-left" />
            </Link>
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold text-chart-100">
                {t("expedition.round", { number: run.round })}
                <span className="ml-2 font-normal text-chart-400">{label}</span>
                {run.summited && (
                  <span className="ml-2 text-beacon-400" title={t("expedition.summit.title")}>
                    <Glyph name="chevrons-up" />
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-chart-400">
                {beyond ??
                  t("expedition.roundMeta", {
                    count: round.cities.length,
                    radius: round.radiusKm.toLocaleString("en-US"),
                  })}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className="flex items-center gap-1"
              role="img"
              aria-label={t("expedition.livesLeft", { count: run.lives })}
            >
              {Array.from({ length: EXPEDITION_LIVES }, (_, index) => (
                <Life key={index} spent={index >= run.lives} />
              ))}
            </span>
            <span className="font-display text-sm font-bold text-chart-100 tabular-nums">
              {run.score}
              <span className="ml-1 text-[10px] font-normal text-chart-500">
                {t("expedition.pts")}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:grid-cols-[1fr_320px] lg:pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <div className="space-y-4">
          {run.over && (
            <Panel
              title={t("expedition.over.title")}
              subtitle={t("expedition.over.reached", { round: roundsReached(run) })}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {run.history.map((record) => (
                  <RoundPip key={record.number} ending={record.ending} />
                ))}
              </div>
              <p className="mt-3 text-xs text-chart-400">
                {t("expedition.over.score", { count: run.score, hits: run.hits, cards: run.cards })}
              </p>
              {run.summited && (
                <p className="mt-1 text-xs text-beacon-400">{t("expedition.summit.done")}</p>
              )}
              {challenge && (
                <p className="mt-1 text-xs text-chart-300">
                  {run.score > challenge.score
                    ? t("expedition.challenge.beaten", { score: challenge.score })
                    : t("expedition.challenge.missed", { score: challenge.score })}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={share}>
                  {copied ? t("daily.copied") : t("expedition.share")}
                </Button>
                <Button type="button" variant="secondary" onClick={onRestart}>
                  {t("expedition.again")}
                </Button>
                <Button type="button" variant="ghost" onClick={onReconfigure}>
                  {t("expedition.change")}
                </Button>
              </div>
            </Panel>
          )}

          <Panel title={t("daily.hand.title")} subtitle={placing ? banner : legend}>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {config.categories.map((category) => {
                const cityId = run.picks[category];
                const city = round.cities.find((c) => c.id === cityId);
                const isInPlay = inPlay === category;
                const isSettled = settledCards.includes(category);
                const mark = isSettled ? cardVerdict(round, category, cityId).mark : null;

                return (
                  <CategoryCard
                    key={isInPlay ? `${category}-${run.round}-${run.draws.length}` : category}
                    category={category}
                    label={t(`card.${category}.short`)}
                    disabled
                    tone={mark ?? (isInPlay ? "drawn" : "muted")}
                    className={cx(isInPlay && "animate-deal")}
                    footer={
                      city ? (
                        <span className="text-chart-300">{cityName(city, locale)}</span>
                      ) : isInPlay ? (
                        <span className="text-beacon-400">{t("expedition.inPlay")}</span>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          </Panel>

          <Panel
            title={t("expedition.board")}
            subtitle={t("expedition.streak", { count: onTable, score: worth })}
          >
            {ended && round.cities.length > 0 && (
              <div className="mb-3">
                <MiniMap cities={round.cities} highlights={highlights} height={260} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {round.cities.map((city) => {
                const here = run.draws.filter((category) => run.picks[category] === city.id);
                const isStruck = run.struck.includes(city.id);
                const targetable = placing && !run.over && !isStruck;
                const isAnswer = (highlights[city.id] ?? []).length > 0;

                return (
                  <button
                    key={city.id}
                    type="button"
                    disabled={!targetable}
                    onClick={() => assign(city.id)}
                    className={cx(
                      "rounded-xl border p-3 text-left transition-all",
                      targetable
                        ? "cursor-pointer border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-beacon-500 hover:bg-beacon-500/10"
                        : "cursor-default border-chart-800 bg-chart-900/70",
                      isAnswer && "border-beacon-500/50 bg-beacon-500/[0.07]",
                      isStruck && "opacity-40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cx(
                          "font-display text-sm font-semibold text-chart-100",
                          isStruck && "text-chart-500 line-through",
                        )}
                      >
                        {cityName(city, locale)}
                      </span>
                      {city.country && (
                        <span className="font-mono text-[10px] text-chart-500">{city.country}</span>
                      )}
                    </div>

                    <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1">
                      {here.length === 0 ? (
                        <span className="text-[11px] text-chart-600">—</span>
                      ) : (
                        here.map((category) => (
                          <Badge
                            key={category}
                            tone={
                              settledCards.includes(category)
                                ? cardVerdict(round, category, city.id).mark === "hit"
                                  ? "signal"
                                  : "muted"
                                : "beacon"
                            }
                          >
                            <CategoryIcon category={category} />
                          </Badge>
                        ))
                      )}
                    </div>

                    {ended && (
                      <div className="mt-2 font-mono text-[10px] text-chart-500">
                        {formatCoordinate(city.latitude, "lat")} ·{" "}
                        {formatCoordinate(city.longitude, "lon")} ·{" "}
                        {formatPopulation(city.population)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          {settledCards.length > 0 && (
            <Panel title={t("daily.answers")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {settledCards.map((category) => {
                  const answer = round.answers[category];
                  const mine = round.cities.find((c) => c.id === run.picks[category]);
                  const verdict = cardVerdict(round, category, run.picks[category]);
                  const mark = verdict.mark;

                  return (
                    <div
                      key={category}
                      className={cx("animate-rise rounded-xl border p-3", MARK_STYLE[mark])}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-chart-400 uppercase">
                        <CategoryIcon category={category} className="text-beacon-500" />
                        {t(`card.${category}`)}
                        <span className="ml-auto flex items-center">
                          <MarkSquare mark={mark} />
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="font-display text-lg font-bold text-beacon-400">
                          {answer ? cityName(answer, locale) : ""}
                        </span>
                        {answer?.country && (
                          <span className="font-mono text-[10px] text-chart-500">
                            {answer.country}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-[11px] text-chart-500">
                        {mark === "hit" ? (
                          <span className="text-signal-400">{t("daily.youHadIt")}</span>
                        ) : mine && answer ? (
                          <>
                            {t("daily.youPlayed", {
                              city: cityName(mine, locale),
                              miss: (() => {
                                const miss = missOf(mine, answer, category);
                                return miss ? t(miss.key, { value: miss.value }) : "";
                              })(),
                            })}
                            {mark === "close" && (
                              <span className="text-beacon-400">{t("daily.runnerUp")}</span>
                            )}
                            .
                          </>
                        ) : (
                          t("daily.notPlayed")
                        )}
                      </div>

                      {/* Where the pick actually placed. A red cross teaches
                          nothing; "4th of 8" is what makes the next board
                          easier to read. */}
                      {mark !== "hit" && verdict.rank !== null && (
                        <div className="mt-1 text-[11px] text-chart-400">
                          {t("expedition.rank", { rank: verdict.rank, of: verdict.of })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title={t("expedition.progress")}>
            <div className="flex gap-2">
              <Stat label={t("expedition.stat.round")} value={run.round} />
              <Stat label={t("expedition.stat.lives")} value={run.lives} />
              <Stat label={t("expedition.stat.score")} value={run.score} />
            </div>

            {/* The summit: the point the circle stops closing, and the thing a
                run can be said to have won rather than merely survived. */}
            <div className="mt-4 border-t border-chart-800 pt-3">
              {run.summited ? (
                <p className="text-xs text-beacon-400">{t("expedition.summit.past")}</p>
              ) : (
                <>
                  <p className="text-xs text-chart-400">
                    {t("expedition.summit.toGo", { count: toSummit })}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chart-800">
                    <div
                      className="h-full rounded-full bg-beacon-500 transition-all"
                      style={{
                        width: `${Math.min(100, ((run.round - 1) / Math.max(1, run.summitAt - 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3 border-t border-chart-800 pt-3 text-xs">
              <span
                className={cx(
                  "inline-flex items-center gap-1.5",
                  run.compass > 0 ? "text-chart-300" : "text-chart-600 line-through",
                )}
              >
                <Glyph name="compass" />
                {t("expedition.compass.name")}
              </span>
              <span
                className={cx(
                  "inline-flex items-center gap-1.5",
                  run.secondWind > 0 ? "text-chart-300" : "text-chart-600 line-through",
                )}
              >
                <Glyph name="swap" />
                {t("expedition.secondWind.name")}
              </span>
            </div>

            {run.history.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-chart-800 pt-3">
                {run.history.map((record) => (
                  <RoundPip key={record.number} ending={record.ending} />
                ))}
              </div>
            )}
          </Panel>

          {challenge && !run.over && (
            <Panel title={t("expedition.challenge.title")}>
              <p className="text-xs text-chart-400">
                {t("expedition.challenge.body", {
                  round: challenge.round,
                  count: challenge.score,
                })}
              </p>

              {/* Their run over yours, round for round. One number at the end
                  is a target; this is the thing you are behind in while you
                  are still playing. */}
              {challenge.rounds.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[10px] tracking-[0.12em] text-chart-500 uppercase">
                      {t("expedition.challenge.them")}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {challenge.rounds.map((ending, index) => (
                        <RoundPip key={index} ending={ending} />
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[10px] tracking-[0.12em] text-chart-500 uppercase">
                      {t("expedition.challenge.you")}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {run.history.map((record) => (
                        <RoundPip key={record.number} ending={record.ending} />
                      ))}
                      {/* The round in hand, so the two rows stay aligned. */}
                      {!run.over && (
                        <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border border-dashed border-chart-600" />
                      )}
                    </span>
                  </div>
                </div>
              )}

              <p
                className={cx(
                  "mt-3 text-xs font-semibold",
                  run.score > challenge.score ? "text-signal-400" : "text-chart-400",
                )}
              >
                {run.score > challenge.score
                  ? t("expedition.challenge.ahead")
                  : t("expedition.challenge.behind", { score: challenge.score - run.score })}
              </p>
            </Panel>
          )}

          <Panel title={t("expedition.settings.title")}>
            <p className="text-xs text-chart-400">
              {t("expedition.settings.body", { region: label, count: total })}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {config.categories.map((category) => (
                <Badge key={category} tone="muted">
                  <CategoryIcon category={category} />
                  {t(`card.${category}.short`)}
                </Badge>
              ))}
            </div>
            {!run.over && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={onReconfigure}
              >
                {t("expedition.abandon")}
              </Button>
            )}
          </Panel>

          <Panel title={t("expedition.daily.title")}>
            <p className="text-xs text-chart-400">{t("expedition.daily.body")}</p>
            <Link href="/daily" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                {t("expedition.daily.cta")}
              </Button>
            </Link>
          </Panel>
        </div>
      </div>

      {/* Action bar — fixed at the bottom, mirroring the board and the daily. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-beacon-500/30 bg-beacon-500 shadow-2xl shadow-black/40 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
            {shown && !run.over && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                <CategoryIcon category={shown} className="text-base" />
                {t(`card.${shown}.short`)}
              </span>
            )}
            <span className="min-w-0 truncate text-sm text-chart-800">{banner}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {compassReady && (
              <button
                type="button"
                onClick={compass}
                title={t("expedition.compass.help", { count: COMPASS_STRIKES })}
                className="inline-flex items-center gap-1.5 rounded-full border border-chart-950/50 bg-chart-950/10 px-4 py-2.5 text-sm font-bold text-chart-950 transition-all hover:bg-chart-950/20 sm:py-2"
              >
                <Glyph name="compass" />
                {t("expedition.compass.use")}
              </button>
            )}

            {secondWindReady && (
              <button
                type="button"
                onClick={secondWind}
                className="inline-flex items-center gap-1.5 rounded-full border border-chart-950/50 bg-chart-950/10 px-4 py-2.5 text-sm font-bold text-chart-950 transition-all hover:bg-chart-950/20 sm:py-2"
              >
                <Glyph name="swap" />
                {t("expedition.secondWind.use")}
              </button>
            )}

            {placing && ready && (
              <button
                type="button"
                onClick={settle}
                className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
              >
                {t("daily.reveal")}
              </button>
            )}

            {/* The crossroads. Banking is the safe verb and sits on the left as
                plain text; pushing is the loud one, because the whole round is
                built to tempt you into it. */}
            {crossroads && (
              <>
                <button
                  type="button"
                  onClick={bank}
                  className="rounded-full border border-chart-950/50 bg-chart-950/10 px-5 py-2.5 text-sm font-bold text-chart-950 transition-all hover:bg-chart-950/20 sm:py-2"
                >
                  {t("expedition.bank", { score: banked })}
                </button>
                {pushable ? (
                  <button
                    type="button"
                    onClick={push}
                    className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
                  >
                    {t("expedition.push", { value: stake })}
                  </button>
                ) : (
                  <span className="text-sm text-chart-800">{t("expedition.pushEmpty")}</span>
                )}
              </>
            )}

            {ended && !run.over && (
              <button
                type="button"
                onClick={advance}
                className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
              >
                {t("expedition.next")} <Glyph name="arrow-right" />
              </button>
            )}

            {run.over && (
              <button
                type="button"
                onClick={share}
                className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
              >
                {copied ? t("daily.copied") : t("expedition.share")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ExpeditionRun;
