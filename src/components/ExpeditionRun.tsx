import { useEffect, useMemo, useState } from "react";
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
  EXPEDITION_LIVES,
  ExpeditionConfig,
  ExpeditionRun as Run,
  getCurrentCard,
  loadExpeditionStats,
  markFor,
  nextRound,
  recordRun,
  revealRound,
  roundFor,
  roundsReached,
  saveExpeditionStats,
  shareText,
  startRun,
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

/** One finished round in the run strip: survived, or paid for. */
const RoundPip = ({ perfect }: { perfect: boolean }) => (
  <span
    className={cx(
      "inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]",
      perfect ? "bg-signal-500" : "bg-alert-500",
    )}
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
  /** Start over with the same settings. */
  onRestart: () => void;
  /** Back to the setup screen. */
  onReconfigure: () => void;
}

/**
 * A run in progress: place the cards, reveal, and either take the next round or
 * lose a life. The board is rebuilt from the seed and the round number rather
 * than stored, so a reload picks the run up exactly where it was.
 */
const ExpeditionRun = ({
  pool,
  startRadius,
  seed,
  config,
  restored,
  onRestart,
  onReconfigure,
}: ExpeditionRunProps) => {
  const { locale, t } = useLocale();
  const { play } = useSound();
  useFixedTopBar();

  const [run, setRun] = useState<Run>(() => {
    const initial = restored ?? startRun(seed, config);
    // Draw the current card for the first round
    return { ...initial, currentCard: getCurrentCard(seed, initial.round, config.categories) };
  });
  const [selected, setSelected] = useState<Category | null>(null);
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [drawingCard, setDrawingCard] = useState(false);

  // A round in play is worth keeping the screen awake for; a finished run is not.
  useWakeLock(!run.over);

  const round = useMemo(
    () => roundFor(pool, startRadius, config, run.seed, run.round),
    [pool, startRadius, config, run.seed, run.round],
  );

  // Update currentCard when round changes
  useEffect(() => {
    if (!run.currentCard && !run.revealed) {
      const card = getCurrentCard(seed, run.round, config.categories);
      setRun((current) => ({ ...current, currentCard: card }));
    }
  }, [seed, run.round, run.currentCard, run.revealed, config.categories]);

  const label = regionLabel(config.region, t);
  const total = config.categories.length;
  const currentCard = run.currentCard;
  const placed = currentCard ? (run.picks[currentCard] ? 1 : 0) : 0;
  const ready = placed === 1;
  const hits = run.revealed ? run.history[run.history.length - 1]?.hits ?? 0 : 0;
  const perfect = run.revealed && hits === total;

  // The run is the only thing worth persisting: the boards come back from the
  // seed. A finished run is folded into the record and stops being active.
  useEffect(() => {
    const stats = loadExpeditionStats();
    saveExpeditionStats(
      run.over ? recordRun(stats, run) : { ...stats, active: run },
    );
  }, [run]);

  const assign = (cityId: string) => {
    if (!currentCard || run.revealed) return;
    setRun((current) => ({ ...current, picks: { ...current.picks, [currentCard]: cityId } }));
    setSelected(null);
    play("flip");
  };

  const reveal = () => {
    if (run.revealed || !ready) return;
    const next = revealRound(run, round);
    setRun(next);
    setSelected(null);

    const wasPerfect = next.history[next.history.length - 1]?.perfect;
    if (next.over) play("fanfare");
    else play(wasPerfect ? "chime" : "buzz");
    // Confetti skips itself under reduced motion, so no guard is needed here.
    if (wasPerfect) setCelebrate((count) => count + 1);
  };

  const advance = () => {
    setRun((current) => nextRound(current));
    setSelected(null);
    setDrawingCard(true);
    // Reset drawingCard after a brief animation
    setTimeout(() => setDrawingCard(false), 1000);
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
          <MarkSquare mark={mark} size={10} />
          {t(`daily.legend.${mark}`)}
        </span>
      ))}
    </span>
  );

  const highlights = run.revealed
    ? config.categories.reduce<Record<string, Category[]>>((map, category) => {
        const answer = round.answers[category];
        if (!answer) return map;
        map[answer.id] = [...(map[answer.id] ?? []), category];
        return map;
      }, {})
    : {};

  const banner = run.over
    ? t("expedition.over.title")
    : run.revealed
      ? perfect
        ? t("expedition.perfect")
        : t("expedition.lostLife")
      : selected
        ? t("daily.hand.pick")
        : currentCard
          ? t("expedition.hand.placeOne", { card: t(`card.${currentCard}.short`) })
          : t("expedition.hand.place", { count: total });

  return (
    <>
      {celebrate > 0 && <Confetti trigger={celebrate} />}

      {/* Status banner — fixed at the top, mirroring the board and the daily. */}
      <div
        className={cx(
          "fixed inset-x-0 top-0 z-40 border-b backdrop-blur",
          selected && !run.revealed
            ? "border-beacon-500/30 bg-beacon-500"
            : "border-chart-700 bg-chart-950/95",
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              aria-label={t("expedition.back")}
              className={cx(
                "tap-target grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-sm transition-colors",
                selected && !run.revealed
                  ? "border-chart-950/20 text-chart-950 hover:bg-chart-950/10"
                  : "border-chart-700 text-chart-400 hover:bg-chart-800 hover:text-chart-200",
              )}
            >
              <Glyph name="arrow-left" />
            </Link>
            <div className="min-w-0">
              <div
                className={cx(
                  "truncate font-display text-sm font-bold",
                  selected && !run.revealed ? "text-chart-950" : "text-chart-100",
                )}
              >
                {t("expedition.round", { number: run.round })}
                <span
                  className={cx(
                    "ml-2 font-normal",
                    selected && !run.revealed ? "text-chart-800" : "text-chart-400",
                  )}
                >
                  {label}
                </span>
              </div>
              <div
                className={cx(
                  "truncate text-xs",
                  selected && !run.revealed ? "text-chart-800" : "text-chart-400",
                )}
              >
                {t("expedition.roundMeta", {
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
            {!run.revealed && (
              <span
                className={cx(
                  "text-xs font-medium",
                  selected ? "text-chart-900" : "text-chart-400",
                )}
              >
                {placed}/{total}
              </span>
            )}
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
                  <RoundPip key={record.number} perfect={record.perfect} />
                ))}
              </div>
              <p className="mt-3 text-xs text-chart-400">
                {t("expedition.over.cards", { hits: run.hits, cards: run.cards })}
              </p>
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

          <Panel
            title={t("daily.hand.title")}
            subtitle={run.revealed ? legend : banner}
          >
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {config.categories.map((category) => {
                const cityId = run.picks[category];
                const city = round.cities.find((c) => c.id === cityId);
                const isCurrent = currentCard === category;
                const isSelected = selected === category;
                const mark = run.revealed ? markFor(round, category, cityId) : null;
                const disabled = run.revealed || !isCurrent;

                return (
                  <CategoryCard
                    key={category}
                    category={category}
                    label={t(`card.${category}.short`)}
                    disabled={disabled}
                    onClick={() => setSelected(isSelected ? null : category)}
                    tone={mark ?? (isSelected ? "selected" : isCurrent ? "beacon" : cityId ? "filled" : "idle")}
                    className={cx(
                      !run.revealed && isCurrent && !isSelected && "hover:-translate-y-0.5",
                      !run.revealed && isCurrent && !isSelected && !cityId && "hover:border-chart-400",
                      drawingCard && isCurrent && "animate-pulse",
                    )}
                    footer={
                      city ? (
                        <span className="text-chart-300">
                          <Glyph name="arrow-right" /> {cityName(city, locale)}
                        </span>
                      ) : (
                        <span className="text-chart-600">{t("daily.notPlaced")}</span>
                      )
                    }
                  />
                );
              })}
            </div>
          </Panel>

          <Panel
            title={t("daily.board.title")}
            subtitle={t(run.revealed ? "daily.board.revealed" : "daily.board.hidden")}
          >
            {run.revealed && (
              <div className="mb-3">
                <MiniMap cities={round.cities} highlights={highlights} height={260} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {round.cities.map((city) => {
                const here = currentCard ? [currentCard].filter((category) => run.picks[category] === city.id) : [];
                const targetable = !run.revealed && !!selected && currentCard === selected;
                const isAnswer = currentCard ? (highlights[city.id] ?? []).includes(currentCard) : false;

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
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-chart-100">
                        {cityName(city, locale)}
                      </span>
                      {city.country && (
                        <span className="font-mono text-[10px] text-chart-500">
                          {city.country}
                        </span>
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
                              run.revealed
                                ? markFor(round, category, city.id) === "hit"
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

                    {run.revealed && (
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

          {run.revealed && currentCard && (
            <Panel title={t("daily.answers")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {[currentCard].map((category) => {
                  const answer = round.answers[category];
                  const mine = round.cities.find((c) => c.id === run.picks[category]);
                  const mark = markFor(round, category, run.picks[category]);

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
              <Stat label={t("expedition.stat.hits")} value={`${run.hits}/${run.cards || 0}`} />
            </div>

            {run.history.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-chart-800 pt-3">
                {run.history.map((record) => (
                  <RoundPip key={record.number} perfect={record.perfect} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title={t("expedition.settings.title")}>
            <p className="text-xs text-chart-400">
              {t("expedition.settings.body", {
                region: label,
                count: total,
              })}
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
            {selected && !run.revealed && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                <CategoryIcon category={selected} className="text-base" />
                {t(`card.${selected}.short`)}
              </span>
            )}
            <span className="min-w-0 truncate text-sm text-chart-800">
              {run.revealed && !run.over
                ? t("expedition.roundResult", { hits: hits, total: 1 })
                : banner}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {selected && !run.revealed && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-chart-800 underline underline-offset-4 hover:text-chart-950"
              >
                {t("board.cancel")}
              </button>
            )}
            {ready && !run.revealed && !selected && (
              <button
                type="button"
                onClick={reveal}
                className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
              >
                {t("daily.reveal")}
              </button>
            )}
            {run.revealed && !run.over && (
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
