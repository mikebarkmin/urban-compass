// Work-in-progress daily puzzles, held in the author's browser until they are
// downloaded and committed as `game/data/dailyPuzzles.json`.
//
// The drafts *are* that file: on a browser that has never authored anything
// they are seeded from the committed version, so a second session picks up
// where the first left off and a puzzle can be removed as well as added.

import { City } from "../../game/cities";
import { AUTHORED, AuthoredPuzzle, isDayKey } from "@/utils/daily";

const STORAGE_KEY = "urban-compass:daily-drafts";

export type DailyDrafts = Record<string, AuthoredPuzzle>;

const isDraft = (value: unknown): value is AuthoredPuzzle =>
  !!value &&
  typeof value === "object" &&
  Array.isArray((value as AuthoredPuzzle).cities);

/** A fresh copy of the committed puzzles, to start from or to reset to. */
export const committedDrafts = (): DailyDrafts =>
  Object.fromEntries(
    Object.entries(AUTHORED).map(([key, entry]) => [
      key,
      { ...entry, cities: [...entry.cities] },
    ]),
  );

/**
 * The saved drafts. A browser with nothing saved starts from the committed
 * file; one that has saved an empty set keeps it, so deleting every puzzle
 * sticks rather than being undone on the next visit.
 */
export const loadDrafts = (): DailyDrafts => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return committedDrafts();

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const drafts: DailyDrafts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isDayKey(key) || !isDraft(value)) continue;
      drafts[key] = {
        cities: value.cities as City[],
        ...(value.note ? { note: value.note } : {}),
      };
    }
    return drafts;
  } catch {
    return committedDrafts();
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

/** The file contents to commit, with the days in chronological order. */
export const serializeDrafts = (drafts: DailyDrafts): string => {
  const ordered: DailyDrafts = {};
  for (const key of Object.keys(drafts).sort()) ordered[key] = drafts[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
};
