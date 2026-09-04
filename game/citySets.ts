// The pools of cities a host can pick from before starting a game.

import { City, Category, supportedCategories } from "./cities";
import { germanCities } from "./data/germany";
import { europeanCities } from "./data/europe";
import { worldCities } from "./data/world";
import { europeEasyCities } from "./data/europeEasy";
import { europeHardCities } from "./data/europeHard";
import { worldEasyCities } from "./data/worldEasy";
import { worldHardCities } from "./data/worldHard";

/**
 * Roughly how much geography a set asks of you. `easy` is household names,
 * `hard` leans on places most players cannot pin down, and `standard` sits in
 * between.
 */
export type Difficulty = "easy" | "standard" | "hard";

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "standard", "hard"];

export interface CitySet {
  id: string;
  /** English name, and the fallback wherever a translation is missing. */
  name: string;
  difficulty: Difficulty;
  icon: string;
  cities: City[];
}

export const CITY_SETS: CitySet[] = [
  {
    id: "europe-easy",
    name: "Europe · the big names",
    difficulty: "easy",
    icon: "🇪🇺",
    cities: europeEasyCities,
  },
  {
    id: "world-easy",
    name: "World · the big names",
    difficulty: "easy",
    icon: "🌍",
    cities: worldEasyCities,
  },
  {
    id: "germany",
    name: "Germany",
    difficulty: "standard",
    icon: "🇩🇪",
    cities: germanCities,
  },
  {
    id: "europe",
    name: "Europe",
    difficulty: "standard",
    icon: "🗺️",
    cities: europeanCities,
  },
  {
    id: "world",
    name: "World",
    difficulty: "standard",
    icon: "🌐",
    cities: worldCities,
  },
  {
    id: "europe-hard",
    name: "Europe · the far corners",
    difficulty: "hard",
    icon: "🧭",
    cities: europeHardCities,
  },
  {
    id: "world-hard",
    name: "World · the ends of the earth",
    difficulty: "hard",
    icon: "🏔️",
    cities: worldHardCities,
  },
];

export const DEFAULT_CITY_SET_ID = "europe-easy";

export const getCitySet = (id: string): CitySet | undefined =>
  CITY_SETS.find((set) => set.id === id);

/** Which cards a built-in set can offer. */
export const citySetCategories = (set: CitySet): Category[] =>
  supportedCategories(set.cities);

/** The id used for a pool that was uploaded by the host rather than built in. */
export const CUSTOM_CITY_SET_ID = "custom";

/**
 * Validate a pool that arrived from a client. Anything malformed is dropped so
 * a bad upload can never corrupt the game state.
 */
export const sanitizeCityPool = (input: unknown): City[] => {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const cities: City[] = [];

  /** An optional numeric field: kept when usable, dropped when not. */
  const optional = (value: unknown, min: number, max: number): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
    return parsed;
  };

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;

    const id = typeof candidate.id === "string" ? candidate.id.slice(0, 80) : "";
    const name =
      typeof candidate.name === "string" ? candidate.name.slice(0, 80) : "";
    const latitude = Number(candidate.latitude);
    const longitude = Number(candidate.longitude);
    const population = Number(candidate.population);

    if (!id || !name || seen.has(id)) continue;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) continue;
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      continue;
    if (!Number.isFinite(population) || population < 0) continue;

    // Below the Dead Sea and above Everest are both impossible for a
    // settlement, so anything outside that range is a parsing accident.
    const elevation = optional(candidate.elevation, -500, 6000);
    const area = optional(candidate.area, 0, 100000);

    seen.add(id);
    cities.push({
      id,
      name,
      ...(typeof candidate.nameDe === "string" && candidate.nameDe
        ? { nameDe: candidate.nameDe.slice(0, 80) }
        : {}),
      country:
        typeof candidate.country === "string"
          ? candidate.country.slice(0, 12)
          : undefined,
      latitude,
      longitude,
      population: Math.round(population),
      ...(elevation !== undefined ? { elevation: Math.round(elevation) } : {}),
      ...(area !== undefined ? { area: Math.round(area * 100) / 100 } : {}),
    });

    if (cities.length >= MAX_CUSTOM_CITIES) break;
  }

  return cities;
};

/** Upper bound on an uploaded pool, so a huge file cannot flood the room. */
export const MAX_CUSTOM_CITIES = 2000;

/** A pool needs at least this many cities to be playable. */
export const MIN_POOL_SIZE = 4;
