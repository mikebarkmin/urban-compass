// Persist custom / uploaded city sets in localStorage so the host can re-apply
// them in a new room without re-uploading the same file or rebuilding the same
// filter. Each saved set is a name + a `City[]`; nothing here touches the game
// server — applying a saved set feeds the existing `upload_city_set` action.

import { City } from "../../game/cities";

const STORAGE_KEY = "urban-guessr:saved-sets";

/** A city set saved in the host's browser. */
export interface SavedCitySet {
  id: string;
  name: string;
  cities: City[];
  createdAt: number;
}

const safeRead = (): SavedCitySet[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedSet) : [];
  } catch {
    return [];
  }
};

const isSavedSet = (value: unknown): value is SavedCitySet => {
  if (!value || typeof value !== "object") return false;
  const set = value as Record<string, unknown>;
  return (
    typeof set.id === "string" &&
    typeof set.name === "string" &&
    Array.isArray(set.cities) &&
    typeof set.createdAt === "number"
  );
};

const safeWrite = (sets: SavedCitySet[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch {
    // Quota exceeded or storage disabled — saving is best-effort.
  }
};

/** All saved sets, newest first. */
export const loadSavedSets = (): SavedCitySet[] =>
  safeRead().sort((a, b) => b.createdAt - a.createdAt);

/** Persist a set. A name collision overwrites the older entry. */
export const saveSet = (name: string, cities: City[]): SavedCitySet => {
  const trimmed = name.trim().slice(0, 60) || "Custom set";
  const existing = safeRead();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: SavedCitySet = { id, name: trimmed, cities, createdAt: Date.now() };

  const without = existing.filter((set) => set.name !== trimmed);
  safeWrite([entry, ...without]);
  return entry;
};

/** Remove a saved set by id. */
export const deleteSavedSet = (id: string): SavedCitySet[] => {
  const remaining = safeRead().filter((set) => set.id !== id);
  safeWrite(remaining);
  return remaining.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Update an existing saved set's name and cities in place. If the new name
 * collides with another saved set, the other set is removed (the edited one
 * wins). Returns the refreshed list, newest first.
 */
export const updateSavedSet = (
  id: string,
  name: string,
  cities: City[],
): SavedCitySet[] => {
  const trimmed = name.trim().slice(0, 60) || "Custom set";
  const existing = safeRead();
  const updated = existing
    .filter((set) => set.id === id || set.name !== trimmed)
    .map((set) =>
      set.id === id ? { ...set, name: trimmed, cities } : set,
    );
  safeWrite(updated);
  return updated.sort((a, b) => b.createdAt - a.createdAt);
};
