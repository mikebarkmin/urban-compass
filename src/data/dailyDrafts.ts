// Work-in-progress daily puzzle suggestions, held in the author's browser
// until they are downloaded and sent in.
//
// Drafts are the author's own work only: they are never seeded from the
// committed days, so the existing daily quizzes stay private. They are kept
// as one map in storage — a day is the unit on disk, not in a browser.

import { City } from "../../game/cities";
import { AuthoredPuzzle, isDayKey } from "@/utils/daily";

const STORAGE_KEY = "urban-compass:daily-drafts";

export type DailyDrafts = Record<string, AuthoredPuzzle>;

const isDraft = (value: unknown): value is AuthoredPuzzle =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as AuthoredPuzzle).cities);

/**
 * The saved drafts. A browser with nothing saved starts empty — the panel
 * is a suggestion tool, not a view onto the existing daily quizzes.
 */
export const loadDrafts = (): DailyDrafts => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const drafts: DailyDrafts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isDayKey(key) || !isDraft(value)) continue;
      drafts[key] = {
        cities: value.cities as City[],
        ...(value.theme ? { theme: value.theme } : {}),
      };
    }
    return drafts;
  } catch {
    return {};
  }
};

export const saveDrafts = (drafts: DailyDrafts): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Quota exceeded or storage disabled — the download still works.
  }
};

/**
 * "Mexico — Independence Day" -> "mexico-independence-day", for the half of the
 * filename that says what the board is about.
 */
const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export interface DraftFile {
  /** What to save it as, e.g. "2026-09-19-oktoberfest-bavaria.json". */
  filename: string;
  contents: string;
}

/**
 * One day as the file to commit. The day is inside it, not only in the name,
 * and the cities are ids alone — the build joins them against the gazetteer,
 * so a board never carries a second copy of a population or a name.
 */
export const draftFile = (key: string, draft: AuthoredPuzzle): DraftFile => {
  const named = draft.theme ? `${key}-${slug(draft.theme.en)}` : key;
  const board = {
    day: key,
    ...(draft.theme ? { theme: draft.theme } : {}),
    cities: draft.cities.map((city) => city.id),
  };
  return {
    filename: `${named}.json`,
    contents: `${JSON.stringify(board, null, 2)}\n`,
  };
};

/** Every draft as its own file, in chronological order. */
export const draftFiles = (drafts: DailyDrafts): DraftFile[] =>
  Object.keys(drafts)
    .sort()
    .map((key) => draftFile(key, drafts[key]));
