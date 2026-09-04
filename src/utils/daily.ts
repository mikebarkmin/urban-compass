import {
  CORE_CATEGORIES,
  Category,
  City,
  drawBoard,
  getCorrectAnswers,
  mulberry32,
  rankCitiesFor,
  seedFromString,
} from "../../game/cities";
import { europeanCities } from "../../game/data/europe";

/**
 * The solo puzzle. Everybody gets the same board on the same day, drawn from
 * one fixed set so that scores are worth comparing, and generated from the date
 * alone so that no server has to remember anything.
 */

/** Day 1 of the daily. Kept fixed so puzzle numbers never shift. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

export const DAILY_CITY_COUNT = 8;
export const DAILY_SET_ID = "europe";

/**
 * The daily always plays the six cards every set can answer. The altitude and
 * area pairs are a room setting, not something to spring on a shared puzzle —
 * and six squares is what makes the result grid readable.
 */
export const DAILY_CATEGORIES: Category[] = CORE_CATEGORIES;

/** The UTC day key, e.g. "2026-09-05" — the same one everywhere on earth. */
export const dayKey = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 10);

/** Puzzle number for a day key, counting from the epoch. */
export const puzzleNumber = (key: string): number =>
  Math.round((Date.parse(`${key}T00:00:00Z`) - EPOCH) / DAY_MS) + 1;

export interface DailyPuzzle {
  key: string;
  number: number;
  cities: City[];
  answers: Partial<Record<Category, City>>;
  /** The city that came second in each category — a "so close" rather than a miss. */
  runnersUp: Record<Category, City | null>;
}

/** Build (or rebuild) a day's puzzle. Pure: the same key always gives the same board. */
export const buildPuzzle = (key: string): DailyPuzzle => {
  const random = mulberry32(seedFromString(`urban-guessr/${key}`));
  const cities = drawBoard(
    europeanCities,
    DAILY_CITY_COUNT,
    "balanced",
    random,
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

const STORAGE_KEY = "urban-guessr:daily";

export interface DailyResult {
  key: string;
  number: number;
  picks: Picks;
  score: number;
}

export interface DailyStats {
  streak: number;
  bestStreak: number;
  played: number;
  totalScore: number;
  /** Today's finished attempt, if there is one. */
  last: DailyResult | null;
}

export const emptyStats = (): DailyStats => ({
  streak: 0,
  bestStreak: 0,
  played: 0,
  totalScore: 0,
  last: null,
});

/**
 * Read the saved stats. Anything unreadable — a private window, a browser with
 * storage switched off, a value from an older shape — is treated as a clean
 * slate rather than an error.
 */
export const loadStats = (): DailyStats => {
  if (typeof window === "undefined") return emptyStats();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<DailyStats>;

    return {
      streak: Number(parsed.streak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      played: Number(parsed.played) || 0,
      totalScore: Number(parsed.totalScore) || 0,
      last:
        parsed.last && typeof parsed.last.key === "string"
          ? {
              key: parsed.last.key,
              number: Number(parsed.last.number) || puzzleNumber(parsed.last.key),
              picks: (parsed.last.picks ?? {}) as Picks,
              score: Number(parsed.last.score) || 0,
            }
          : null,
    };
  } catch {
    return emptyStats();
  }
};

/**
 * Fold a finished attempt into the saved stats. Solving the day after the last
 * one extends the streak, a gap restarts it, and replaying the same day changes
 * nothing — the result is already banked.
 */
export const recordResult = (stats: DailyStats, result: DailyResult): DailyStats => {
  if (stats.last?.key === result.key) return stats;

  const consecutive =
    stats.last !== null && result.number - stats.last.number === 1;
  const streak = consecutive ? stats.streak + 1 : 1;

  return {
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    played: stats.played + 1,
    totalScore: stats.totalScore + result.score,
    last: result,
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

/** The Wordle-style result grid: one square per card, in category order. */
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
    `Urban Guessr Daily #${puzzle.number} — ${score}/${DAILY_CATEGORIES.length}`,
    squares,
  ];
  if (origin) lines.push(`${origin}/daily`);
  return lines.join("\n");
};
