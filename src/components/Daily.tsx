import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Category,
  categoryIcons,
  cityName,
  formatCoordinate,
  formatPopulation,
  missOf,
} from "../../game/cities";
import {
  DAILY_CATEGORIES,
  DAILY_SET_ID,
  DailyStats,
  Mark,
  Picks,
  buildPuzzle,
  dayKey,
  emptyStats,
  loadStats,
  markFor,
  msUntilNextDay,
  recordResult,
  saveStats,
  scorePicks,
  shareText,
} from "@/utils/daily";
import { useLocale } from "@/i18n";
import { Badge, Button, Panel, cx } from "./ui";
import MiniMap from "./MiniMap";

const MARK_STYLE = {
  hit: "border-signal-500/60 bg-signal-500/10",
  close: "border-beacon-500/50 bg-beacon-500/10",
  miss: "border-chart-700 bg-chart-900/70",
} as const;

/**
 * The on-page result grid is drawn rather than typed. The 🟩🟨⬛ squares that go
 * into the shared text are missing from a fair number of emoji fonts and fall
 * back to empty boxes, which is fine in a chat app but not on the page itself.
 */
const MARK_FILL = {
  hit: "bg-signal-500",
  close: "bg-beacon-500",
  miss: "bg-chart-700",
} as const;

const MarkSquare = ({ mark, size = 14 }: { mark: Mark; size?: number }) => (
  <span
    className={cx("inline-block shrink-0 rounded-[3px]", MARK_FILL[mark])}
    style={{ width: size, height: size }}
    aria-hidden
  />
);

/** A compact stat for the footer strip. */
const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex-1 text-center">
    <div className="font-display text-xl font-bold text-chart-100 tabular-nums">{value}</div>
    <div className="text-[10px] tracking-[0.12em] text-chart-500 uppercase">{label}</div>
  </div>
);

/** Format a millisecond duration as H:MM:SS, clamped at 0 on the low end. */
const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

/**
 * The solo puzzle: one board a day, all six cards placed at once, then a single
 * reveal. No room, no host, nobody else to wait for.
 */
const Daily = () => {
  const { locale, t } = useLocale();
  // Everything below depends on the date and on localStorage, so the first
  // render is deliberately empty — it keeps the server and client markup in step.
  const [today, setToday] = useState<string | null>(null);
  const [stats, setStats] = useState<DailyStats>(emptyStats);
  const [picks, setPicks] = useState<Picks>({});
  const [selected, setSelected] = useState<Category | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const key = dayKey();
    const saved = loadStats();
    setToday(key);
    setStats(saved);

    // Today's puzzle is one-shot: if it is already banked, show that result.
    if (saved.last?.key === key) {
      setPicks(saved.last.picks);
      setRevealed(true);
    }
  }, []);

  // Tick down to the next UTC midnight, but only once the puzzle is done —
  // before that the countdown is noise. Updates each second.
  useEffect(() => {
    if (!revealed) return;
    setTimeLeft(msUntilNextDay());
    const id = window.setInterval(() => setTimeLeft(msUntilNextDay()), 1000);
    return () => window.clearInterval(id);
  }, [revealed]);

  const puzzle = useMemo(() => (today ? buildPuzzle(today) : null), [today]);

  if (!puzzle) {
    return (
      <div className="panel mt-20 grid place-items-center p-16 text-center text-sm text-chart-400">
        {t("daily.loading")}
      </div>
    );
  }

  const placedCount = DAILY_CATEGORIES.filter((category) => picks[category]).length;
  const score = revealed ? scorePicks(puzzle, picks) : 0;
  const ready = placedCount === DAILY_CATEGORIES.length;
  const showBottomBar = revealed || !!selected || ready;

  const assign = (cityId: string) => {
    if (!selected || revealed) return;
    setPicks((current) => ({ ...current, [selected]: cityId }));
    setSelected(null);
  };

  const reveal = () => {
    if (revealed || placedCount < DAILY_CATEGORIES.length) return;
    const result = {
      key: puzzle.key,
      number: puzzle.number,
      picks,
      score: scorePicks(puzzle, picks),
    };
    const next = recordResult(stats, result);
    setStats(next);
    saveStats(next);
    setRevealed(true);
  };

  const share = async () => {
    const origin =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
    try {
      await navigator.clipboard.writeText(shareText(puzzle, picks, origin));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Drawn once and reused, so the legend and the grid cannot drift apart.
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

  const highlights = revealed
    ? DAILY_CATEGORIES.reduce<Record<string, Category[]>>((map, category) => {
        const answer = puzzle.answers[category];
        if (!answer) return map;
        map[answer.id] = [...(map[answer.id] ?? []), category];
        return map;
      }, {})
    : {};

  return (
    <>
      {/* Status banner — fixed at the top, mirroring the multiplayer board. */}
      <div
        className={cx(
          "fixed inset-x-0 top-0 z-40 border-b backdrop-blur",
          selected && !revealed
            ? "border-beacon-500/30 bg-beacon-500"
            : "border-chart-700 bg-chart-950/95",
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              aria-label={t("daily.backToRooms")}
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-sm transition-colors",
                selected && !revealed
                  ? "border-chart-950/20 text-chart-950 hover:bg-chart-950/10"
                  : "border-chart-700 text-chart-400 hover:bg-chart-800 hover:text-chart-200",
              )}
            >
              ←
            </Link>
            <div className="min-w-0">
              <div
                className={cx(
                  "truncate font-display text-sm font-bold",
                  selected && !revealed ? "text-chart-950" : "text-chart-100",
                )}
              >
                {t("daily.title", { number: puzzle.number })}
                {revealed && (
                  <span className="ml-2 text-beacon-400">
                    {score}/{DAILY_CATEGORIES.length}
                  </span>
                )}
              </div>
              <div
                className={cx(
                  "truncate text-xs",
                  selected && !revealed ? "text-chart-800" : "text-chart-400",
                )}
              >
                {t("daily.meta", {
                  date: puzzle.key,
                  set: t(`set.${DAILY_SET_ID}.name`),
                  count: puzzle.cities.length,
                })}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {revealed ? (
              <span
                className="flex items-center gap-1"
                role="img"
                aria-label={t("daily.resultLabel", {
                  score,
                  total: DAILY_CATEGORIES.length,
                })}
              >
                {DAILY_CATEGORIES.map((category) => (
                  <MarkSquare key={category} mark={markFor(puzzle, category, picks[category])} />
                ))}
              </span>
            ) : (
              <span
                className={cx(
                  "text-xs font-medium",
                  selected && !revealed ? "text-chart-900" : "text-chart-400",
                )}
              >
                {placedCount}/{DAILY_CATEGORIES.length}
              </span>
            )}
          </div>
        </div>
      </div>

    <div className="grid gap-4 pb-32 pt-[4.5rem] lg:grid-cols-[1fr_320px] lg:pb-28 lg:pt-20">
      <div className="space-y-4">

        <Panel
          title={t("daily.hand.title")}
          subtitle={
            revealed
              ? legend
              : selected
                ? t("daily.hand.pick")
                : t("daily.hand.place", { count: DAILY_CATEGORIES.length })
          }
        >
          <div className="flex flex-wrap gap-2">
            {DAILY_CATEGORIES.map((category) => {
              const cityId = picks[category];
              const city = puzzle.cities.find((c) => c.id === cityId);
              const isSelected = selected === category;
              const mark = revealed ? markFor(puzzle, category, cityId) : null;

              return (
                <button
                  key={category}
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelected(isSelected ? null : category)}
                  className={cx(
                    "w-[104px] rounded-xl border px-3 py-3 text-left transition-all",
                    mark
                      ? MARK_STYLE[mark]
                      : isSelected
                        ? "-translate-y-1 border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20"
                        : cityId
                          ? "border-chart-500 bg-chart-800 hover:-translate-y-0.5"
                          : "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-chart-400",
                  )}
                >
                  <span
                    className={cx(
                      "font-display text-2xl leading-none",
                      isSelected ? "text-beacon-400" : "text-chart-400",
                    )}
                  >
                    {categoryIcons[category]}
                  </span>
                  <span className="mt-2 block text-xs leading-tight font-medium text-chart-200">
                    {t(`card.${category}.short`)}
                  </span>
                  <span
                    className={cx(
                      "mt-1.5 block truncate text-[10px]",
                      city ? "text-chart-300" : "text-chart-600",
                    )}
                  >
                    {city ? `→ ${cityName(city, locale)}` : t("daily.notPlaced")}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title={t("daily.board.title")}
          subtitle={t(revealed ? "daily.board.revealed" : "daily.board.hidden")}
        >
          {revealed && (
            <div className="mb-3">
              <MiniMap cities={puzzle.cities} highlights={highlights} height={260} />
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {puzzle.cities.map((city) => {
              const here = DAILY_CATEGORIES.filter((category) => picks[category] === city.id);
              const targetable = !revealed && !!selected;
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
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-chart-100">
                      {cityName(city, locale)}
                    </span>
                    {city.country && (
                      <span className="mt-0.5 shrink-0 font-mono text-[10px] text-chart-500">
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
                            revealed
                              ? markFor(puzzle, category, city.id) === "hit"
                                ? "signal"
                                : "muted"
                              : "beacon"
                          }
                        >
                          {categoryIcons[category]}
                        </Badge>
                      ))
                    )}
                  </div>

                  {revealed && (
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

        {revealed && (
          <Panel title={t("daily.answers")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAILY_CATEGORIES.map((category) => {
                const answer = puzzle.answers[category];
                const mine = puzzle.cities.find((c) => c.id === picks[category]);
                const mark = markFor(puzzle, category, picks[category]);

                return (
                  <div
                    key={category}
                    className={cx("animate-rise rounded-xl border p-3", MARK_STYLE[mark])}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-chart-400 uppercase">
                      <span className="text-beacon-500">{categoryIcons[category]}</span>
                      {t(`card.${category}`)}
                      <span className="ml-auto flex items-center">
                        <MarkSquare mark={mark} />
                      </span>
                    </div>

                    <div className="mt-1.5 font-display text-lg font-bold text-beacon-400">
                      {answer ? cityName(answer, locale) : ""}
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
        <Panel title={t("daily.record")}>
          <div className="flex gap-2">
            <Stat label={t("daily.streak")} value={stats.streak} />
            <Stat label={t("daily.best")} value={stats.bestStreak} />
            <Stat label={t("daily.played")} value={stats.played} />
            <Stat
              label={t("daily.average")}
              value={stats.played > 0 ? (stats.totalScore / stats.played).toFixed(1) : "—"}
            />
          </div>

          {revealed && (
            <p className="mt-4 border-t border-chart-800 pt-3 text-xs text-chart-500">
              {t("daily.done")}{" "}
              {timeLeft !== null && (
                <span className="font-mono tabular-nums text-chart-300">
                  {t("daily.nextIn", {
                    time: formatDuration(timeLeft),
                  })}
                </span>
              )}
            </p>
          )}
        </Panel>

        <Panel title={t("daily.multiplayer.title")}>
          <p className="text-xs text-chart-400">{t("daily.multiplayer.body")}</p>
          <Link href="/" className="mt-3 inline-block">
            <Button variant="secondary" size="sm">
              {t("daily.multiplayer.cta")}
            </Button>
          </Link>
        </Panel>
      </div>
    </div>

      {/* Action bar — fixed at the bottom, mirroring the multiplayer board. */}
      {showBottomBar && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-beacon-500/30 bg-beacon-500 shadow-2xl shadow-black/40 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
              {selected && !revealed && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  <span className="text-base">{categoryIcons[selected]}</span>
                  {t(`card.${selected}.short`)}
                </span>
              )}
              <span className="min-w-0 truncate text-sm text-chart-800">
                {revealed
                  ? t("daily.resultLabel", { score, total: DAILY_CATEGORIES.length })
                  : selected
                    ? t("daily.hand.pick")
                    : t("daily.hand.place", { count: DAILY_CATEGORIES.length })}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              {selected && !revealed && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm text-chart-800 underline underline-offset-4 hover:text-chart-950"
                >
                  {t("board.cancel")}
                </button>
              )}
              {ready && !revealed && !selected && (
                <button
                  type="button"
                  onClick={reveal}
                  className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
                >
                  {t("daily.reveal")}
                </button>
              )}
              {revealed && (
                <button
                  type="button"
                  onClick={share}
                  className="rounded-full border border-chart-950 bg-chart-950 px-5 py-2.5 text-sm font-bold text-beacon-400 shadow-lg shadow-black/30 transition-all hover:bg-chart-900 sm:py-2"
                >
                  {copied ? t("daily.copied") : t("daily.share")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Daily;
