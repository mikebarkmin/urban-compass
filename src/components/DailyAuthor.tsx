import { useEffect, useMemo, useState } from "react";
import {
  Category,
  City,
  categoryIcons,
  cityName,
  drawBoard,
  formatPopulation,
  getCorrectAnswers,
  supportedCategories,
} from "../../game/cities";
import { CITY_SETS, MIN_POOL_SIZE } from "../../game/citySets";
import {
  DAILY_CATEGORIES,
  DAILY_CITY_COUNT,
  FIRST_KEY,
  dayKey,
  isDayKey,
  shiftKey,
} from "@/utils/daily";
import {
  DailyDrafts,
  committedDrafts,
  loadDrafts,
  saveDrafts,
  serializeDrafts,
} from "@/data/dailyDrafts";
import { SavedCitySet, loadSavedSets } from "@/data/savedSets";
import { downloadBlob } from "@/utils";
import { useLocale } from "@/i18n";
import { Badge, Button, Field, Panel, cx, inputClass } from "./ui";
import MiniMap from "./MiniMap";

/** A pool the board can be drawn from: a built-in set or one saved here. */
interface Source {
  id: string;
  label: string;
  cities: City[];
}

/**
 * Hand-author a day's board. The panel edits the contents of
 * `game/data/dailyPuzzles.json` and hands the finished file back as a download;
 * committing it is what puts the puzzle live, since the site is a static build
 * with nowhere to write to at runtime.
 */
const DailyAuthor = () => {
  const { locale, t } = useLocale();

  const [today, setToday] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DailyDrafts>({});
  const [savedSets, setSavedSets] = useState<SavedCitySet[]>([]);

  // The day being edited, and the key it was loaded from — changing the date
  // moves the puzzle rather than leaving a copy behind on the old day.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [originalKey, setOriginalKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [board, setBoard] = useState<City[]>([]);
  const [sourceId, setSourceId] = useState(CITY_SETS[0].id);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setToday(dayKey());
    setDrafts(loadDrafts());
    setSavedSets(loadSavedSets());
  }, []);

  const sources: Source[] = useMemo(
    () => [
      ...CITY_SETS.map((set) => ({
        id: set.id,
        label: t(`set.${set.id}.name`),
        cities: set.cities,
      })),
      ...savedSets.map((set) => ({
        id: `saved:${set.id}`,
        label: set.name,
        cities: set.cities,
      })),
    ],
    [savedSets, t],
  );

  const source = sources.find((entry) => entry.id === sourceId) ?? sources[0];

  const persist = (next: DailyDrafts) => {
    setDrafts(next);
    saveDrafts(next);
  };

  /** The first future day that has nothing on it yet. */
  const nextFreeKey = (from: string): string => {
    let key = shiftKey(from, 1);
    while (drafts[key]) key = shiftKey(key, 1);
    return key;
  };

  const startNew = () => {
    if (!today) return;
    const key = nextFreeKey(today);
    setEditingKey(key);
    setOriginalKey(null);
    setNote("");
    setBoard([]);
    setSearch("");
  };

  const startEdit = (key: string) => {
    setEditingKey(key);
    setOriginalKey(key);
    setNote(drafts[key].note ?? "");
    setBoard([...drafts[key].cities]);
    setSearch("");
  };

  const cancel = () => {
    setEditingKey(null);
    setOriginalKey(null);
    setBoard([]);
    setSearch("");
  };

  const remove = (key: string) => {
    const next = { ...drafts };
    delete next[key];
    persist(next);
    if (originalKey === key) cancel();
  };

  const save = () => {
    if (!editingKey || !isDayKey(editingKey) || board.length < MIN_POOL_SIZE) return;

    const next = { ...drafts };
    if (originalKey && originalKey !== editingKey) delete next[originalKey];
    next[editingKey] = {
      cities: board,
      ...(note.trim() ? { note: note.trim().slice(0, 80) } : {}),
    };
    persist(next);
    cancel();
  };

  const draw = () => {
    setBoard(
      drawBoard(source.cities, DAILY_CITY_COUNT, "balanced", Math.random, DAILY_CATEGORIES),
    );
  };

  // Cities from the chosen pool that match the search and are not on the board
  // already. Capped so a broad search cannot render thousands of rows.
  const additions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const present = new Set(board.map((city) => city.id));

    return source.cities
      .filter(
        (city) =>
          !present.has(city.id) &&
          (city.name.toLowerCase().includes(term) ||
            city.nameDe?.toLowerCase().includes(term) ||
            city.country?.toLowerCase() === term),
      )
      .slice(0, 30);
  }, [search, source, board]);

  // What the board would play like: the six answers, and how many distinct
  // cities they land on. A board where one city takes several cards collapses
  // the puzzle, so it is worth flagging before the day goes live.
  const preview = useMemo(() => {
    if (board.length === 0) return null;

    const supported = new Set(supportedCategories(board));
    const unanswerable = DAILY_CATEGORIES.filter((category) => !supported.has(category));
    const answers = getCorrectAnswers(board, DAILY_CATEGORIES);
    const winners = new Set(
      DAILY_CATEGORIES.map((category) => answers[category]?.id).filter(Boolean),
    );

    return { answers, unanswerable, distinct: winners.size };
  }, [board]);

  const highlights = useMemo(() => {
    if (!preview) return {};
    return DAILY_CATEGORIES.reduce<Record<string, Category[]>>((map, category) => {
      const answer = preview.answers[category];
      if (!answer) return map;
      map[answer.id] = [...(map[answer.id] ?? []), category];
      return map;
    }, {});
  }, [preview]);

  const download = () => {
    downloadBlob(
      new Blob([serializeDrafts(drafts)], { type: "application/json" }),
      "dailyPuzzles.json",
    );
  };

  if (!today) return null;

  const draftKeys = Object.keys(drafts).sort().reverse();
  const tooFew = board.length < MIN_POOL_SIZE;
  const dateIsPast = !!editingKey && editingKey <= today;

  return (
    <Panel
      title={t("author.title")}
      subtitle={t("author.lede")}
      action={
        !editingKey ? (
          <Button size="sm" onClick={startNew}>
            {t("author.new")}
          </Button>
        ) : undefined
      }
    >
      {/* The file as it stands. */}
      {draftKeys.length === 0 ? (
        <p className="text-xs text-chart-500">{t("author.none")}</p>
      ) : (
        <ul className="space-y-2">
          {draftKeys.map((key) => (
            <li
              key={key}
              className={cx(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                key === originalKey
                  ? "border-beacon-500/60 bg-beacon-500/10"
                  : "border-chart-800 bg-chart-900/50",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-chart-100">{key}</span>
                  {drafts[key].note && <Badge tone="muted">{drafts[key].note}</Badge>}
                  {key <= today && <Badge tone="beacon">{t("author.datePast")}</Badge>}
                </div>
                <div className="text-[11px] text-chart-500">
                  {t("picker.cities", { count: drafts[key].cities.length })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => startEdit(key)}>
                  {t("author.edit")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(key)}>
                  {t("saved.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingKey !== null && (
        <div className="mt-4 space-y-4 rounded-xl border border-chart-700 bg-chart-850/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("author.date")} hint={t("author.dateHint")}>
              <input
                type="date"
                className={inputClass}
                value={editingKey}
                min={FIRST_KEY}
                onChange={(event) => setEditingKey(event.target.value)}
              />
            </Field>
            <Field label={t("author.note")}>
              <input
                className={inputClass}
                value={note}
                maxLength={80}
                placeholder={t("author.notePlaceholder")}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t("author.source")}>
              <select
                className={inputClass}
                value={source.id}
                onChange={(event) => setSourceId(event.target.value)}
              >
                {sources.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="secondary" onClick={draw}>
              {board.length > 0 ? t("author.reroll") : t("author.draw")}
            </Button>
          </div>

          {/* The board itself. */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-chart-500 uppercase">
                {t("author.board")}
              </span>
              <Badge tone={tooFew ? "muted" : "signal"}>
                {t("builder.count", { count: board.length })}
              </Badge>
            </div>

            {board.length === 0 ? (
              <p className="text-xs text-chart-500">{t("author.empty")}</p>
            ) : (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {board.map((city) => (
                  <li
                    key={city.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-chart-800 bg-chart-900/50 px-3 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs text-chart-200">
                      {cityName(city, locale)}
                      {city.country && (
                        <span className="ml-1.5 font-mono text-[10px] text-chart-500">
                          {city.country}
                        </span>
                      )}
                      <span className="ml-1.5 text-[10px] text-chart-600">
                        {formatPopulation(city.population)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={t("saved.delete")}
                      className="tap-target shrink-0 text-chart-500 hover:text-alert-500"
                      onClick={() =>
                        setBoard((current) => current.filter((c) => c.id !== city.id))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Search the chosen pool to add a city by hand. */}
          <div>
            <input
              className={inputClass}
              value={search}
              placeholder={t("author.searchPlaceholder")}
              onChange={(event) => setSearch(event.target.value)}
            />
            {additions.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {additions.map((city) => (
                  <li key={city.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-chart-800 bg-chart-900/50 px-3 py-1.5 text-left text-xs text-chart-300 hover:border-beacon-500 hover:bg-beacon-500/10"
                      onClick={() => {
                        setBoard((current) => [...current, city]);
                        setSearch("");
                      }}
                    >
                      + {cityName(city, locale)}
                      {city.country && (
                        <span className="ml-1.5 font-mono text-[10px] text-chart-500">
                          {city.country}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* How the board plays. */}
          {preview && (
            <div className="space-y-3">
              <MiniMap cities={board} highlights={highlights} height={200} />

              <div className="grid gap-1.5 sm:grid-cols-2">
                {DAILY_CATEGORIES.map((category) => {
                  const answer = preview.answers[category];
                  return (
                    <div
                      key={category}
                      className="flex items-center gap-2 rounded-lg border border-chart-800 bg-chart-900/50 px-3 py-1.5 text-xs"
                    >
                      <span className="text-beacon-500">{categoryIcons[category]}</span>
                      <span className="text-chart-500">{t(`card.${category}.short`)}</span>
                      <span className="ml-auto truncate font-semibold text-chart-100">
                        {answer ? cityName(answer, locale) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {preview.unanswerable.length > 0 && (
                <p className="rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
                  {t("author.warnUnanswerable")}
                </p>
              )}
              {preview.distinct < DAILY_CATEGORIES.length && (
                <p className="rounded-lg border border-beacon-500/40 bg-beacon-500/10 px-3 py-2 text-xs text-beacon-400">
                  {t("author.warnHoard", {
                    distinct: preview.distinct,
                    total: DAILY_CATEGORIES.length,
                  })}
                </p>
              )}
            </div>
          )}

          {tooFew && (
            <p className="rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
              {t("author.tooFew", { needed: MIN_POOL_SIZE })}
            </p>
          )}
          {dateIsPast && (
            <p className="rounded-lg border border-beacon-500/40 bg-beacon-500/10 px-3 py-2 text-xs text-beacon-400">
              {t("author.warnPast")}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={tooFew || !isDayKey(editingKey)}
              onClick={save}
            >
              {t("author.save")}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancel}>
              {t("author.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Getting the file back out. */}
      <div className="mt-4 border-t border-chart-800 pt-3">
        <p className="text-xs text-chart-500">{t("author.downloadHint")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={download}>
            {t("author.download")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => persist(committedDrafts())}>
            {t("author.reset")}
          </Button>
        </div>
      </div>
    </Panel>
  );
};

export default DailyAuthor;
