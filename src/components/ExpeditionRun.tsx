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
  ExpeditionRamp,
  ExpeditionRun as Run,
  DESCENT_ROUNDS,
  conquestRound,
  lastCard,
  loadExpeditionStats,
  nextRound,
  pushLuck,
  pushValue,
  recordRun,
  RoundEnding,
  roundFor,
  requiredCards,
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
import { Badge, Button, Panel, cx, useCountUp, useReducedMotion } from "./ui";
import { MuteToggle, useFixedTopBar } from "./Layout";
import { MARK_STYLE, MarkSquare } from "./MarkSquare";
import { CategoryIcon, Glyph } from "./Glyph";
import CategoryCard from "./CategoryCard";
import MiniMap from "./MiniMap";
import Confetti from "./Confetti";
import { regionLabel } from "./ExpeditionSetup";
import {
  CardDraw,
  ClimbDial,
  Crossroads,
  LifeRow,
  PotStage,
  RoundPip,
  RoundResult,
  RunOver,
} from "./ExpeditionStage";

interface ExpeditionRunProps {
  pool: City[];
  /** Where this pool's circle starts and stops, measured once by the parent. */
  ramp: ExpeditionRamp;
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
  ramp,
  seed,
  config,
  restored,
  challenge,
  onRestart,
  onReconfigure,
}: ExpeditionRunProps) => {
  const { locale, t } = useLocale();
  const { play } = useSound();
  // The run carries its own bar, and mute with it, so the site header goes.
  useFixedTopBar(true);

  const [run, setRun] = useState<Run>(() => restored ?? startRun(seed, config, ramp));
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  /** The beat between a card landing and the game asking for the next bet.
   *  A counter rather than a flag, so the hold restarts on each new verdict. */
  const [beat, setBeat] = useState(0);
  /** The crossroads, stepped aside so the board underneath can be studied. */
  const [peeking, setPeeking] = useState(false);
  /** What the card just banked, floated off the stack. Keyed so it replays. */
  const [gain, setGain] = useState<{ value: number; key: number } | null>(null);
  /** Bumped on a bust, to shake the board that took the stack. */
  const [shake, setShake] = useState(0);
  /**
   * The card just dealt, held on screen for a beat before the board. Keyed so
   * that dealing the same category twice running still restarts the hold, and
   * so the timer below can own its own lifetime.
   */
  const [dealt, setDealt] = useState<{ card: Category; key: number } | null>(null);
  const reduced = useReducedMotion();

  // A round in play is worth keeping the screen awake for; a finished run is not.
  useWakeLock(!run.over);

  const round = useMemo(
    () => roundFor(pool, ramp, config, run.seed, run.round, run.summitAt),
    [pool, ramp, config, run.seed, run.round, run.summitAt],
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
  // A bust pays nothing, but the stage should show what it cost rather than a
  // zero: the number the round was standing at, struck through.
  const potShown = ended && run.ending === "bust" ? roundScore(onTable) : worth;

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

  // A card arriving is the round's question being asked, and it lands face-up
  // on the screen for a moment.
  //
  // Deliberately not seeded from the run's opening state: seeding would make
  // the very first card of every run the one card never dealt on screen. The
  // phase check below is what keeps a restored run quiet, and it is the right
  // test — a run picked up mid-placing *is* being asked that card right now,
  // so showing it is telling the truth about the present.
  const drawn = useRef<string | null>(null);
  useEffect(() => {
    const key = `${run.round}:${run.draws.length}`;
    if (key === drawn.current) return;
    const previous = drawn.current;
    drawn.current = key;

    if (previous !== null) {
      const [wasRound, wasCount] = previous.split(":").map(Number);
      // A new round deals card one, so the count going *down* is not proof
      // that nothing was dealt — only a rewind inside the same round is, and
      // a second wind hands back a card that was already seen.
      if (run.round === wasRound && run.draws.length < wasCount) return;
    }

    // Not gated on reduced motion: which card is being asked for is
    // information, and the CSS already collapses the entrance animation under
    // that query. Only the beat below is motion, and only that is skipped.
    if (run.phase !== "placing") return;

    setDealt({ card: run.draws[run.draws.length - 1], key: Date.now() });
  }, [run.round, run.draws, run.phase]);

  // Both holds below own their timer inside the effect that watches the state
  // it clears, rather than arming it in one effect and clearing it in an
  // unmount-only other. Strict mode remounts an effect, and the split version
  // let the remount kill a live timer while the guard above declined to arm a
  // new one — which left the card on screen for good.
  useEffect(() => {
    if (!dealt) return;
    const id = window.setTimeout(() => setDealt(null), 1400);
    return () => window.clearTimeout(id);
  }, [dealt]);

  const skipDeal = () => setDealt(null);

  // A reveal that resolves into the next question in the same frame is not a
  // reveal. Hold the verdict on screen before the crossroads takes the screen.
  const holdBeat = () => {
    if (reduced) return;
    setBeat((count) => count + 1);
  };

  useEffect(() => {
    if (!beat) return;
    const id = window.setTimeout(() => setBeat(0), 750);
    return () => window.clearTimeout(id);
  }, [beat]);

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
    setPeeking(false);

    if (next.hits > run.hits) {
      // The card landed: the stack just grew by what this card was worth. Shown
      // whether the round then offers the crossroads or simply deals again,
      // because what was won is the same either way.
      setGain({ value: pushValue(streak), key: Date.now() });
    } else if (next.ending === "bust") {
      setShake((count) => count + 1);
    }
    // Let the verdict land on the card and the board before the screen is
    // taken over by what comes next.
    holdBeat();

    if (next.over) play("fanfare");
    else if (next.hits > run.hits) play("chime");
    else play(next.ending === "close" ? "flip" : "buzz");
  };

  const bank = () => {
    const next = bankRound(run);
    setRun(next);
    setPeeking(false);
    holdBeat();
    play("chime");
    // A round worth walking away from is worth a bit of noise. Confetti skips
    // itself under reduced motion, so no guard is needed here.
    if (streak >= 3) setCelebrate((count) => count + 1);
  };

  const push = () => {
    setRun((current) => pushLuck(current));
    setPeeking(false);
    play("flip");
  };

  const compass = () => {
    setRun((current) => spendCompass(current, round));
    play("chime");
  };

  const secondWind = () => {
    setRun((current) => spendSecondWind(current));
    setPeeking(false);
    play("chime");
  };

  const advance = () => {
    const next = nextRound(run);
    setRun(next);
    setGain(null);
    setPeeking(false);
    if (next.conquered) {
      play("fanfare");
      setCelebrate((count) => count + 1);
    } else {
      play("flip");
    }
  };

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

  const banner = run.conquered
    ? t("expedition.conquered.title")
    : run.over
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
  /** How many cards this round demands before the crossroads will appear. */
  const quota = requiredCards(run.round, run.summitAt, config.categories.length);
  /** Where the round stands against that demand, for the badge on the header. */
  const quotaDone = Math.min(run.settled, quota);
  /** How far down the descent this round is, once the summit is behind. */
  const descentAt = Math.max(0, run.round - run.summitAt + 1);
  /** The score in the top bar, counted up rather than swapped out. */
  const shownScore = useCountUp(run.score);
  /** One life left is a state the whole screen should be in, not a grey dot. */
  const lastLife = run.lives === 1 && !run.over;
  /** The last card's answer and what was played on it, for the result screen. */
  const lastAnswer = shown ? (round.answers[shown] ?? null) : null;
  const lastPick = shown
    ? (round.cities.find((city) => city.id === run.picks[shown]) ?? null)
    : null;
  const lastVerdict = shown ? cardVerdict(round, shown, run.picks[shown]) : null;

  /** What the crossroads is worth pushing for, if there is a card left. */
  const nextCard = pushable ? stake : null;
  /** What the card in play is worth to the stack — the same ramp, one step
   *  earlier, so the stake is visible while the card is still being placed. */
  const atStake = ended || run.over ? null : pushValue(streak);
  const dialLabel = run.summited
    ? t("expedition.dial.descent", { round: descentAt, total: DESCENT_ROUNDS })
    : t("expedition.dial.climb", {
        round: run.round,
        summit: run.summitAt,
        radius: round.radiusKm.toLocaleString("en-US"),
      });

  return (
    <>
      {celebrate > 0 && <Confetti trigger={celebrate} />}

      {dealt && (
        <CardDraw
          category={dealt.card}
          label={t(`card.${dealt.card}.short`)}
          round={run.round}
          onDismiss={skipDeal}
          t={t}
        />
      )}

      {/* On the last life the whole frame runs hot. A run about to end should
          not look like a run that just started. */}
      {lastLife && (
        <div
          aria-hidden
          title={t("expedition.lastLife")}
          className="pointer-events-none fixed inset-0 z-30 animate-pulse"
          style={{ boxShadow: "inset 0 0 110px -28px var(--color-alert-500)" }}
        />
      )}

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
            <ClimbDial
              round={run.round}
              summitAt={run.summitAt}
              radius={round.radiusKm}
              startRadius={ramp.startKm}
              summited={run.summited}
              label={dialLabel}
            />
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold text-chart-100">
                {t("expedition.round", { number: run.round })}
                <span className="ml-2 font-normal text-chart-400">{label}</span>
                {run.summited && (
                  <span className="ml-2 text-beacon-400" title={t("expedition.summit.title")}>
                    <Glyph name="chevrons-up" />
                  </span>
                )}
                {/* A round that will not let you bank short says so up front,
                    rather than surprising the player with a missing button. */}
                {quota > 1 && !run.over && (
                  <span
                    className="ml-2 inline-flex items-center rounded-full border border-beacon-500/40 bg-beacon-500/10 px-1.5 py-px align-[1px] text-[10px] font-semibold text-beacon-300"
                    title={t("expedition.quota.hint", { count: quota })}
                  >
                    {t("expedition.quota.badge", { done: quotaDone, count: quota })}
                  </span>
                )}
              </div>
              {/* The long form does not survive a portrait phone next to the
                  lives and the score, and the dial already draws the circle —
                  so the narrow screen gets the half that carries the news. */}
              <div className="truncate text-[11px] text-chart-400 sm:text-xs">
                {beyond ?? (
                  <>
                    <span className="sm:hidden">
                      {t("expedition.roundMetaShort", {
                        radius: round.radiusKm.toLocaleString("en-US"),
                      })}
                    </span>
                    <span className="hidden sm:inline">
                      {t("expedition.roundMeta", {
                        count: round.cities.length,
                        radius: round.radiusKm.toLocaleString("en-US"),
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <LifeRow
              lives={run.lives}
              total={EXPEDITION_LIVES}
              label={t("expedition.livesLeft", { count: run.lives })}
            />
            <span className="font-display text-sm font-bold text-chart-100 tabular-nums">
              {shownScore}
              <span className="ml-1 text-[10px] font-normal text-chart-500">
                {t("expedition.pts")}
              </span>
            </span>
            <MuteToggle />
          </div>
        </div>
      </div>

      {/* The end of the run. Over the game-over panel rather than instead of
          it, so the tally and the way back stay one tap away. */}
      {run.over && !beat && !peeking && (
        <RunOver
          conquered={run.conquered}
          summited={run.summited}
          round={roundsReached(run)}
          score={run.score}
          hits={run.hits}
          cards={run.cards}
          history={run.history}
          challenge={challenge ?? null}
          onShare={share}
          shareLabel={copied ? t("daily.copied") : t("expedition.share")}
          onAgain={onRestart}
          onDismiss={() => setPeeking(true)}
          t={t}
        />
      )}

      {/* The round's verdict, and the only decision left in it. Not shown once
          the run is over: the game-over panel is that round's result, and it
          carries the share link the run ends on. */}
      {ended && !beat && !peeking && !run.over && run.ending && !dealt && (
        <RoundResult
          ending={run.ending}
          score={worth}
          standing={onTable}
          lives={run.lives}
          totalLives={EXPEDITION_LIVES}
          category={shown ?? config.categories[0]}
          label={t(`card.${shown ?? config.categories[0]}`)}
          answer={lastAnswer ? cityName(lastAnswer, locale) : null}
          pick={lastVerdict?.mark === "hit" || !lastPick ? null : cityName(lastPick, locale)}
          rank={lastVerdict?.rank ?? null}
          of={lastVerdict?.of ?? null}
          onSecondWind={secondWindReady ? secondWind : null}
          onNext={advance}
          onDismiss={() => setPeeking(true)}
          t={t}
        />
      )}

      {crossroads && !beat && !peeking && !run.over && (
        <Crossroads
          pot={banked}
          next={nextCard}
          streak={streak}
          onBank={bank}
          onPush={push}
          onDismiss={() => setPeeking(true)}
          t={t}
        />
      )}

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

          {!run.over && (
            <PotStage
              streak={onTable}
              pot={potShown}
              next={atStake}
              phase={run.phase}
              ending={ended ? run.ending : null}
              gain={gain}
              t={t}
            />
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

          {/* Keyed on the shake count so the wobble replays on each bust
              rather than firing once and never again. */}
          <div key={shake} className={cx(shake > 0 && "animate-verdict-shake")}>
          <Panel title={t("expedition.board")}>
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
          </div>

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
            {/* The summit in words. The dial in the top bar draws it; this
                says how far there is left to go. */}
            {run.summited ? (
              <p className="text-xs text-beacon-400">
                {t("expedition.summit.past", {
                  count: Math.max(0, conquestRound(run.summitAt) - run.round + 1),
                })}
              </p>
            ) : (
              <p className="text-xs text-chart-400">
                {t("expedition.summit.toGo", { count: toSummit })}
              </p>
            )}

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

          {run.over && (
            <>
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
              </Panel>

              <Panel title={t("expedition.daily.title")}>
                <p className="text-xs text-chart-400">{t("expedition.daily.body")}</p>
                <Link href="/daily" className="mt-3 inline-block">
                  <Button variant="secondary" size="sm">
                    {t("expedition.daily.cta")}
                  </Button>
                </Link>
              </Panel>
            </>
          )}
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
