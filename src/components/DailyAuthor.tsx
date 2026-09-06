import { useEffect, useMemo, useState } from "react";
import {
  Category,
  City,
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
import { loadCities } from "@/data/citiesLoader";
import { downloadBlob } from "@/utils";
import { useLocale } from "@/i18n";
import { Badge, Button, Field, Panel, Segmented, cx, inputClass } from "./ui";
import MiniMap from "./MiniMap";
import { CategoryIcon } from "./Glyph";

/**
 * Letters that carry no combining accent to strip — NFD leaves them whole — so
 * they need spelling out by hand. Without these, Tromsø and Łódź are reachable
 * only by typing the character itself.
 */
const TRANSLITERATED: Record<string, string> = {
  "ø": "o",
  "æ": "ae",
  "œ": "oe",
  "ß": "ss",
  "ł": "l",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "ħ": "h",
  "ı": "i",
  "ŋ": "n",
};

/**
 * The German convention of writing an umlaut as a digraph. Someone typing on a
 * keyboard without umlauts writes Duesseldorf, which folds to "dusseldorf" and
 * matches nothing, so names carrying one are indexed under this spelling too.
 */
const DIGRAPHS: Record<string, string> = {
  "ä": "ae",
  "ö": "oe",
  "ü": "ue",
  "ß": "ss",
};

const spellOutUmlauts = (value: string): string =>
  value.toLowerCase().replace(/[äöüß]/g, (character) => DIGRAPHS[character]);

/**
 * Lower-cased and stripped of accents, so "Zurich" finds "Zürich". Curated sets
 * are small enough to scroll, but the gazetteer is not: without this, every
 * name carrying a diacritic is unreachable unless you type it exactly.
 */
const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[øæœßłđðþħıŋ]/g, (character) => TRANSLITERATED[character]);

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

  // A set is the right pool to *draw* from — eight cities pulled out of the
  // whole gazetteer would be eight villages nobody can place. Searching is the
  // opposite case: any city can be worth adding by hand, so the search has its
  // own scope, and the full dataset is fetched only once something is typed
  // against it.
  const [scope, setScope] = useState<"all" | "set">("all");
  const [allCities, setAllCities] = useState<City[] | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadedMb, setLoadedMb] = useState(0);
  const [loadError, setLoadError] = useState(false);

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

  /** Pull in the full dataset, once per session — `loadCities` caches it. */
  const ensureAllCities = () => {
    if (allCities || loadingCities) return;
    setLoadingCities(true);
    setLoadError(false);
    void loadCities(setLoadedMb).then((loaded) => {
      setAllCities(loaded);
      setLoadError(loaded.length === 0);
      setLoadingCities(false);
    });
  };

  const searchPool = useMemo(
    () => (scope === "all" ? (allCities ?? []) : source.cities),
    [scope, allCities, source],
  );

  // Folding a couple of hundred thousand names on every keystroke would be far
  // too slow, so the pool is folded once and the search runs against that. The
  // NUL keeps a match from straddling the two names.
  const index = useMemo(
    () =>
      searchPool.map((city) => {
        const names = `${city.name}\u0000${city.nameDe ?? ""}`;
        const text = fold(names);
        // Only the minority of names with an umlaut need the second spelling.
        const digraphs = fold(spellOutUmlauts(names));

        return {
          city,
          text,
          ...(digraphs === text ? {} : { digraphs }),
          country: (city.country ?? "").toLowerCase(),
        };
      }),
    [searchPool],
  );

  // Matches that are not on the board already. A set and the gazetteer give the
  // same city different ids, so places on the board are excluded by name and
  // country as well — otherwise adding Paris from the gazetteer to a board
  // drawn from Europe would put it there twice. Capped, since a broad search
  // over the gazetteer matches thousands.
  const additions = useMemo(() => {
    const term = fold(search.trim());
    if (!term) return [];

    const ids = new Set(board.map((city) => city.id));
    const named = new Set(
      board.map((city) => `${fold(city.name)}/${city.country ?? ""}`),
    );

    return index
      .filter(
        ({ city, text, digraphs, country }) =>
          !ids.has(city.id) &&
          !named.has(`${fold(city.name)}/${city.country ?? ""}`) &&
          (text.includes(term) || digraphs?.includes(term) || country === term),
      )
      // Biggest first: searching "york" should offer New York before a hamlet.
      .sort((a, b) => b.city.population - a.city.population)
      .slice(0, 30)
      .map(({ city }) => city);
  }, [search, index, board]);

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

          {/* Search to add a city by hand, from the set or from everywhere. */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Segmented
                value={scope}
                options={[
                  { value: "all" as const, label: t("author.scopeAll") },
                  { value: "set" as const, label: t("author.scopeSet") },
                ]}
                onChange={(next) => {
                  setScope(next);
                  if (next === "all") ensureAllCities();
                }}
              />
              {scope === "all" && loadingCities && (
                <span className="text-[11px] text-chart-400">
                  {loadedMb > 0.05
                    ? `${t("builder.loading")} ${loadedMb.toFixed(1)} MB`
                    : t("builder.loading")}
                </span>
              )}
            </div>

            <input
              className={inputClass}
              value={search}
              placeholder={t(
                scope === "all" ? "author.searchAllPlaceholder" : "author.searchPlaceholder",
              )}
              onChange={(event) => {
                setSearch(event.target.value);
                if (scope === "all") ensureAllCities();
              }}
            />

            {scope === "all" && loadError && (
              <p className="mt-2 rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
                {t("builder.loadError")}
              </p>
            )}
            {search.trim() && additions.length === 0 && !loadingCities && !loadError && (
              <p className="mt-2 text-xs text-chart-500">{t("author.noMatches")}</p>
            )}
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
                      <CategoryIcon category={category} className="text-beacon-500" />
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
