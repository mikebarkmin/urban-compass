import {
  CORE_CATEGORIES,
  Category,
  City,
  drawBoard,
  getCorrectAnswers,
  mulberry32,
  rankCitiesFor,
  seedFromString,
  supportedCategories,
} from "../../game/cities";
import { MIN_POOL_SIZE, sanitizeCityPool } from "../../game/citySets";
import { europeanCities } from "../../game/data/europe";
import authoredDays from "../../game/data/dailyBoards.generated.json";

/**
 * The solo puzzle. Everybody gets the same board on the same day, drawn from
 * one fixed set so that scores are worth comparing, and generated from the date
 * alone so that no server has to remember anything.
 *
 * A day can also be hand-authored: `game/data/daily/` holds one file per board,
 * and anything in there wins over the draw. Those files name their cities by
 * geonames id; the build joins them against the gazetteer into
 * `dailyBoards.generated.json`, which is what this imports. The join happens at
 * build time rather than in the browser, so an authored day still costs no
 * round trip and its absence needs no error path.
 */

/** Day 1 of the daily. Kept fixed so puzzle numbers never shift. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

export const DAILY_CITY_COUNT = 8;
export const DAILY_SET_ID = "europe";

/** An authored board still has to fit on the same screen as a drawn one. */
const MAX_AUTHORED_CITIES = 16;

/**
 * The daily always plays the six cards every set can answer. The altitude and
 * area pairs are a room setting, not something to spring on a shared puzzle —
 * and six squares is what makes the result grid readable.
 */
export const DAILY_CATEGORIES: Category[] = CORE_CATEGORIES;

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a value is a usable day key. Rejects "2026-02-30" as well as junk. */
export const isDayKey = (value: unknown): value is string =>
  typeof value === "string" &&
  DAY_KEY_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** The UTC day key, e.g. "2026-09-05" — the same one everywhere on earth. */
export const dayKey = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 10);

/** Puzzle number for a day key, counting from the epoch. */
export const puzzleNumber = (key: string): number =>
  Math.round((Date.parse(`${key}T00:00:00Z`) - EPOCH) / DAY_MS) + 1;

/** The day key for a puzzle number — the inverse of `puzzleNumber`. */
export const keyFromNumber = (number: number): string =>
  new Date(EPOCH + (number - 1) * DAY_MS).toISOString().slice(0, 10);

/** The key `days` away from `key`, in either direction. */
export const shiftKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The first day there was a puzzle. Nothing before this is playable. */
export const FIRST_KEY = keyFromNumber(1);

/** Every playable day, newest first. */
export const allDayKeys = (today: string): string[] => {
  const keys: string[] = [];
  for (let number = puzzleNumber(today); number >= 1; number--) {
    keys.push(keyFromNumber(number));
  }
  return keys;
};

/** Milliseconds from `now` until the next UTC midnight. */
export const msUntilNextDay = (now: Date = new Date()): number => {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return next - now.getTime();
};

// --- Authored boards -------------------------------------------------------

/**
 * What a hand-authored board is about, in the languages it has been written
 * in. English is required because it is the fallback everywhere else in the
 * app; a missing German reading falls back to it rather than to the key.
 */
export interface Theme {
  en: string;
  de?: string;
}

/** The theme as this reader should see it, the way `cityName` picks a name. */
export const themeLabel = (theme: Theme | undefined, locale: string): string | undefined =>
  theme && (locale === "de" && theme.de ? theme.de : theme.en);

export interface AuthoredPuzzle {
  /** What the board is about. Shown as the puzzle's title. */
  theme?: Theme;
  cities: City[];
}

/**
 * Read a theme off a raw entry. `{ en, de }` is the shape to write; a bare
 * string is accepted as English-only, which is what drafts saved before the
 * field was translatable look like.
 */
const readTheme = (raw: unknown): Theme | undefined => {
  const clean = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().slice(0, 80);
    return trimmed || undefined;
  };

  if (typeof raw === "string") {
    const en = clean(raw);
    return en ? { en } : undefined;
  }
  if (!raw || typeof raw !== "object") return undefined;

  const { en, de } = raw as { en?: unknown; de?: unknown };
  const english = clean(en);
  if (!english) return undefined;
  const german = clean(de);
  return { en: english, ...(german ? { de: german } : {}) };
};

/**
 * The authored days, validated once at module load. An entry that is malformed,
 * too small, or unable to answer all six cards is dropped rather than thrown —
 * a bad commit costs that day its custom board, not the whole app. Two files
 * claiming the same day is the same kind of mistake: the first one listed wins.
 */
export const AUTHORED: Record<string, AuthoredPuzzle> = (() => {
  const valid: Record<string, AuthoredPuzzle> = {};

  for (const raw of authoredDays) {
    if (!raw || typeof raw !== "object") continue;
    const { day } = raw as { day?: unknown };
    if (!isDayKey(day) || valid[day]) continue;
    const key = day;

    const entry = raw as { theme?: unknown; note?: unknown; cities?: unknown };
    const cities = sanitizeCityPool(entry.cities).slice(0, MAX_AUTHORED_CITIES);
    if (cities.length < MIN_POOL_SIZE) continue;

    const supported = new Set(supportedCategories(cities));
    if (!DAILY_CATEGORIES.every((category) => supported.has(category))) continue;

    // `note` is what the field was called before it could be translated.
    const theme = readTheme(entry.theme ?? entry.note);

    valid[key] = { cities, ...(theme ? { theme } : {}) };
  }

  return valid;
})();

export interface DailyPuzzle {
  key: string;
  number: number;
  cities: City[];
  answers: Partial<Record<Category, City>>;
  /** The city that came second in each category — a "so close" rather than a miss. */
  runnersUp: Record<Category, City | null>;
  /** Whether this board was hand-authored rather than drawn. */
  authored: boolean;
  /** What an authored board is about, when it says. */
  theme?: Theme;
}

/**
 * Build (or rebuild) a day's puzzle. Pure: the same key always gives the same
 * board. An authored day uses the committed cities; every other day is drawn
 * from the date alone.
 */
export const buildPuzzle = (key: string): DailyPuzzle => {
  const authored = AUTHORED[key];

  const cities = authored
    ? authored.cities
    : drawBoard(
        europeanCities,
        DAILY_CITY_COUNT,
        "balanced",
        mulberry32(seedFromString(`urban-compass/${key}`)),
        DAILY_CATEGORIES,
      );

  const runnersUp = {} as Record<Category, City | null>;
  for (const category of DAILY_CATEGORIES) {
    runnersUp[category] = rankCitiesFor(cities, category)[1] ?? null;
  }

  return {
    key,
    number: puzzleNumber(key),
    cities,
    answers: getCorrectAnswers(cities, DAILY_CATEGORIES),
    runnersUp,
    authored: !!authored,
    ...(authored?.theme ? { theme: authored.theme } : {}),
  };
};

/** How a single card was graded. */
export type Mark = "hit" | "close" | "miss";

export const markFor = (
  puzzle: DailyPuzzle,
  category: Category,
  cityId: string | undefined,
): Mark => {
  if (!cityId) return "miss";
  if (puzzle.answers[category]?.id === cityId) return "hit";
  if (puzzle.runnersUp[category]?.id === cityId) return "close";
  return "miss";
};

export type Picks = Partial<Record<Category, string>>;

export const scorePicks = (puzzle: DailyPuzzle, picks: Picks): number =>
  DAILY_CATEGORIES.filter((category) => markFor(puzzle, category, picks[category]) === "hit")
    .length;

// --- Persistence -----------------------------------------------------------

const STORAGE_KEY = "urban-compass:daily";

export interface DailyResult {
  key: string;
  number: number;
  picks: Picks;
  score: number;
  /**
   * A day carried over from before per-day history was kept: it was played, but
   * the picks were not saved. Shown as played, with no result to display.
   */
  synthetic?: boolean;
}

export interface DailyStats {
  streak: number;
  bestStreak: number;
  played: number;
  totalScore: number;
  /** Every finished day, keyed by day key. */
  history: Record<string, DailyResult>;
}

export const emptyStats = (): DailyStats => ({
  streak: 0,
  bestStreak: 0,
  played: 0,
  totalScore: 0,
  history: {},
});

/**
 * The run of consecutive days ending today. A day still in play does not break
 * it — the walk starts at yesterday until today is finished — so catching up on
 * a day you missed repairs the streak rather than leaving a permanent hole.
 */
export const currentStreak = (
  history: Record<string, DailyResult>,
  today: string,
): number => {
  let cursor = history[today] ? today : shiftKey(today, -1);
  let streak = 0;

  while (cursor >= FIRST_KEY && history[cursor]) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }

  return streak;
};

/** The longest run of consecutive days anywhere in the history. */
const longestRun = (history: Record<string, DailyResult>): number => {
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const key of Object.keys(history).sort()) {
    run = previous !== null && shiftKey(previous, 1) === key ? run + 1 : 1;
    if (run > best) best = run;
    previous = key;
  }

  return best;
};

/** Read one stored result, taking the key from the map when there is one. */
const toResult = (key: string | undefined, value: unknown): DailyResult | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const resolved = key ?? raw.key;
  if (!isDayKey(resolved)) return null;

  return {
    key: resolved,
    number: Number(raw.number) || puzzleNumber(resolved),
    picks: (raw.picks && typeof raw.picks === "object" ? raw.picks : {}) as Picks,
    score: Number(raw.score) || 0,
    ...(raw.synthetic === true ? { synthetic: true as const } : {}),
  };
};

/**
 * Read the saved stats. Anything unreadable — a private window, a browser with
 * storage switched off, a value from an older shape — is treated as a clean
 * slate rather than an error.
 *
 * `played` and `totalScore` stay stored counters rather than being derived from
 * the history, so upgrading from the pre-history shape keeps a player's totals.
 */
export const loadStats = (): DailyStats => {
  if (typeof window === "undefined") return emptyStats();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const history: Record<string, DailyResult> = {};
    if (parsed.history && typeof parsed.history === "object") {
      for (const [key, value] of Object.entries(parsed.history as Record<string, unknown>)) {
        const result = toResult(key, value);
        if (result) history[key] = result;
      }
    }

    // The pre-history shape kept one result and a streak counter. Seed the
    // history from that result, and stand placeholders in for the rest of the
    // recorded run so the upgrade does not silently reset a live streak.
    if (Object.keys(history).length === 0) {
      const last = toResult(undefined, parsed.last);
      if (last) {
        history[last.key] = last;
        for (let back = 1; back < (Number(parsed.streak) || 0); back++) {
          const key = shiftKey(last.key, -back);
          if (key < FIRST_KEY) break;
          history[key] = {
            key,
            number: puzzleNumber(key),
            picks: {},
            score: 0,
            synthetic: true,
          };
        }
      }
    }

    return {
      history,
      played: Number(parsed.played) || 0,
      totalScore: Number(parsed.totalScore) || 0,
      streak: currentStreak(history, dayKey()),
      bestStreak: Math.max(Number(parsed.bestStreak) || 0, longestRun(history)),
    };
  } catch {
    return emptyStats();
  }
};

/**
 * Fold a finished attempt into the saved stats. A day that is already banked is
 * never rewritten — the exception is a synthetic placeholder, which can be
 * filled in by actually playing that day without counting it a second time.
 */
export const recordResult = (stats: DailyStats, result: DailyResult): DailyStats => {
  const existing = stats.history[result.key];
  if (existing && !existing.synthetic) return stats;

  const history = { ...stats.history, [result.key]: result };

  return {
    history,
    played: stats.played + (existing ? 0 : 1),
    totalScore: stats.totalScore + result.score,
    streak: currentStreak(history, dayKey()),
    bestStreak: Math.max(stats.bestStreak, longestRun(history)),
  };
};

export const saveStats = (stats: DailyStats): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage being unavailable costs the streak, not the game.
  }
};

// --- Sharing ---------------------------------------------------------------

const SQUARES: Record<Mark, string> = { hit: "🟩", close: "🟨", miss: "⬛" };

/**
 * The Wordle-style result grid: one square per card, in category order. The
 * link carries the day, so whoever opens it sees the board the squares are
 * about rather than whatever is current when they get round to it.
 */
export const shareText = (
  puzzle: DailyPuzzle,
  picks: Picks,
  origin?: string,
): string => {
  const squares = DAILY_CATEGORIES.map((category) =>
    SQUARES[markFor(puzzle, category, picks[category])],
  ).join("");

  const score = scorePicks(puzzle, picks);
  const lines = [
    `Urban Compass Daily #${puzzle.number} — ${score}/${DAILY_CATEGORIES.length}`,
    squares,
  ];
  if (origin) lines.push(`${origin}/daily/?d=${puzzle.key}`);
  return lines.join("\n");
};
