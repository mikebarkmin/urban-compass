import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AUTHORED,
  DAILY_CATEGORIES,
  DailyStats,
  Mark,
  allDayKeys,
  buildPuzzle,
  dayKey,
  emptyStats,
  loadStats,
  markFor,
  puzzleNumber,
} from "@/utils/daily";
import { useLocale } from "@/i18n";
import { Badge, Panel, cx } from "./ui";
import { MarkSquare } from "./MarkSquare";
import { Glyph } from "./Glyph";

/** A compact stat for the summary strip, matching the daily's record panel. */
const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex-1 text-center">
    <div className="font-display text-xl font-bold text-chart-100 tabular-nums">{value}</div>
    <div className="text-[10px] tracking-[0.12em] text-chart-500 uppercase">{label}</div>
  </div>
);

const MONTH_LOCALE: Record<string, string> = { en: "en-GB", de: "de-DE" };

/**
 * Every puzzle since the first one, newest first. A day you have finished shows
 * its result; anything else is a link to go and play it.
 */
const Archive = () => {
  const { locale, t } = useLocale();

  // The list depends on today's date and on localStorage, so the first render
  // is deliberately empty — it keeps the server and client markup in step.
  const [today, setToday] = useState<string | null>(null);
  const [stats, setStats] = useState<DailyStats>(emptyStats);

  useEffect(() => {
    setToday(dayKey());
    setStats(loadStats());
  }, []);

  const intl = MONTH_LOCALE[locale] ?? "en-GB";

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }),
    [intl],
  );
  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intl, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [intl],
  );

  // Newest month first, and newest day first inside each month.
  const months = useMemo(() => {
    if (!today) return [];

    const grouped: { month: string; keys: string[] }[] = [];
    for (const key of allDayKeys(today)) {
      const month = key.slice(0, 7);
      const last = grouped[grouped.length - 1];
      if (last && last.month === month) last.keys.push(key);
      else grouped.push({ month, keys: [key] });
    }
    return grouped;
  }, [today]);

  // Rebuilding a board means redrawing it, which is far too expensive to do
  // per cell per render. Only finished days need one, and only to recover the
  // mark pattern, so grade them once and keep the squares.
  const marks = useMemo(() => {
    const graded: Record<string, Mark[]> = {};
    for (const [key, result] of Object.entries(stats.history)) {
      if (result.synthetic) continue;
      const puzzle = buildPuzzle(key);
      graded[key] = DAILY_CATEGORIES.map((category) =>
        markFor(puzzle, category, result.picks[category]),
      );
    }
    return graded;
  }, [stats]);

  if (!today) {
    return (
      <div className="panel mt-20 grid place-items-center p-16 text-center text-sm text-chart-400">
        {t("daily.loading")}
      </div>
    );
  }

  const solved = Object.values(stats.history).filter((result) => !result.synthetic).length;

  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("archive.title")}
          </h1>
          <p className="mt-1 text-sm text-chart-400">{t("archive.lede")}</p>
        </div>
        <Link
          href="/daily"
          className="rounded-full border border-beacon-500/50 bg-beacon-500/10 px-4 py-2 text-sm font-semibold text-beacon-400 transition-colors hover:bg-beacon-500/20"
        >
          {t("archive.today")} <Glyph name="arrow-right" />
        </Link>
      </div>

      <Panel title={t("daily.record")}>
        <div className="flex gap-2">
          <Stat label={t("daily.streak")} value={stats.streak} />
          <Stat label={t("daily.best")} value={stats.bestStreak} />
          <Stat label={t("daily.played")} value={stats.played} />
          <Stat
            label={t("daily.average")}
            value={solved > 0 ? (stats.totalScore / solved).toFixed(1) : "—"}
          />
        </div>
      </Panel>

      {months.map(({ month, keys }) => (
        <Panel key={month} title={monthLabel.format(new Date(`${month}-01T00:00:00Z`))}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {keys.map((key) => {
              const result = stats.history[key];
              const settled = !!result && !result.synthetic;
              const authored = !!AUTHORED[key];
              const isToday = key === today;

              return (
                <Link
                  key={key}
                  href={{ pathname: "/daily", query: { d: key } }}
                  className={cx(
                    "rounded-xl border p-3 transition-all hover:-translate-y-0.5",
                    settled
                      ? "border-chart-700 bg-chart-850 hover:border-chart-500"
                      : "border-chart-600 bg-chart-850/40 hover:border-beacon-500 hover:bg-beacon-500/10",
                    isToday && "ring-1 ring-beacon-500/50",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-chart-100">
                      #{puzzleNumber(key)}
                    </span>
                    <span className="truncate text-[11px] text-chart-500">
                      {dayLabel.format(new Date(`${key}T00:00:00Z`))}
                    </span>
                  </div>

                  <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
                    {settled ? (
                      <>
                        <span className="flex items-center gap-1">
                          {(marks[key] ?? []).map((mark, index) => (
                            <MarkSquare key={index} size={10} mark={mark} />
                          ))}
                        </span>
                        <span className="text-[11px] tabular-nums text-chart-300">
                          {result.score}/{DAILY_CATEGORIES.length}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-beacon-400">
                        {result ? t("archive.noResult") : t("archive.unplayed")}
                      </span>
                    )}
                  </div>

                  {(authored || isToday) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {isToday && <Badge tone="beacon">{t("archive.today")}</Badge>}
                      {authored && (
                        <Badge tone="muted">
                          {AUTHORED[key].note ?? t("daily.authored")}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
};

export default Archive;
