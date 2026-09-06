// Core city + category model shared by the client and the PartyKit server.

export interface City {
  id: string;
  /** The city's name as English uses it, and the fallback for every language. */
  name: string;
  /** German exonym, where German uses a different name (Rome → Rom). */
  nameDe?: string;
  /** Country code as it appears in the source data, e.g. "D", "PT", "UKR". */
  country?: string;
  latitude: number;
  longitude: number;
  population: number;
  /**
   * Metres above sea level at the city centre. Optional: the older sets do not
   * carry it, and a set without it simply cannot offer the altitude cards.
   */
  elevation?: number;
  /** Administrative area of the city proper, in km². Optional, as above. */
  area?: number;
}

/**
 * A city as it is sent to clients. While a round is being played the
 * coordinates and population are withheld, otherwise every answer would be
 * readable straight off the board.
 */
export interface PublicCity {
  id: string;
  name: string;
  nameDe?: string;
  country?: string;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
  elevation: number | null;
  area: number | null;
}

export type Category =
  | "northernmost"
  | "southernmost"
  | "easternmost"
  | "westernmost"
  | "most_population"
  | "least_population"
  | "highest"
  | "lowest"
  | "largest_area"
  | "smallest_area";

/**
 * The six cards every set can offer, because every city carries coordinates
 * and a population. This is what a room plays with unless the host says
 * otherwise.
 */
export const CORE_CATEGORIES: Category[] = [
  "northernmost",
  "southernmost",
  "easternmost",
  "westernmost",
  "most_population",
  "least_population",
];

/**
 * Every card the game knows about. The altitude and area pairs need a set that
 * carries `elevation` / `area` on every city, so they are only offered when the
 * pool actually supports them.
 */
export const ALL_CATEGORIES: Category[] = [
  ...CORE_CATEGORIES,
  "highest",
  "lowest",
  "largest_area",
  "smallest_area",
];

/** The fewest cards a room can play with. */
export const MIN_CATEGORIES = 3;

// Points for a correct guess, by how early it was placed. Guessing a category
// right after three other players have already done so is worth nothing.
export const SCORING_VALUES: Record<number, number> = {
  1: 3, // First player to place the right card on the right city
  2: 2, // Second
  3: 1, // Third
};

// Card glyphs are not here: they are drawn as SVG paths by the client, in
// `src/components/Glyph.tsx`. They used to be Unicode characters, but the
// double arrows and the geometric shapes are missing from common fonts and
// fell back to an empty box — and a card that renders as a box is unplayable.

/**
 * What each category measures, and which end of it wins. `dir: 1` means the
 * largest value takes the category, `-1` the smallest.
 */
type MetricField = "latitude" | "longitude" | "population" | "elevation" | "area";

const CATEGORY_METRIC: Record<Category, { field: MetricField; dir: 1 | -1 }> = {
  northernmost: { field: "latitude", dir: 1 },
  southernmost: { field: "latitude", dir: -1 },
  easternmost: { field: "longitude", dir: 1 },
  westernmost: { field: "longitude", dir: -1 },
  most_population: { field: "population", dir: 1 },
  least_population: { field: "population", dir: -1 },
  highest: { field: "elevation", dir: 1 },
  lowest: { field: "elevation", dir: -1 },
  largest_area: { field: "area", dir: 1 },
  smallest_area: { field: "area", dir: -1 },
};

/** Which field a card is decided on. */
export const categoryField = (category: Category): MetricField =>
  CATEGORY_METRIC[category].field;

/**
 * The value a category is decided on, or null when this city has nothing to
 * say about it — an older set carries no elevation, for instance.
 */
export const categoryValue = (city: City, category: Category): number | null => {
  const value = city[CATEGORY_METRIC[category].field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

/** Whether every city in the pool can answer this card. */
export const categorySupported = (cities: City[], category: Category): boolean =>
  cities.length > 0 && cities.every((city) => categoryValue(city, category) !== null);

/** The cards a pool is able to offer at all. */
export const supportedCategories = (cities: City[]): Category[] =>
  ALL_CATEGORIES.filter((category) => categorySupported(cities, category));

/**
 * Every city that can answer `category`, ordered best first. Cities missing the
 * figure drop out rather than sorting as zero, which would hand them the
 * "lowest" card by accident.
 */
export const rankCitiesFor = (cities: City[], category: Category): City[] => {
  const { dir } = CATEGORY_METRIC[category];
  return cities
    .filter((city) => categoryValue(city, category) !== null)
    .sort(
      (a, b) =>
        ((categoryValue(b, category) as number) - (categoryValue(a, category) as number)) * dir,
    );
};

/**
 * The right answer for each card in play. A category with nothing to rank is
 * simply absent, so callers check before scoring it.
 */
export const getCorrectAnswers = (
  cities: City[],
  categories: Category[] = CORE_CATEGORIES,
): Partial<Record<Category, City>> => {
  if (cities.length === 0) {
    throw new Error("No cities provided");
  }

  const answers: Partial<Record<Category, City>> = {};
  for (const category of categories) {
    const winner = rankCitiesFor(cities, category)[0];
    if (winner) answers[category] = winner;
  }
  return answers;
};

/** The city that came second in a category — the near miss worth flagging. */
export const runnerUpFor = (cities: City[], category: Category): City | null =>
  rankCitiesFor(cities, category)[1] ?? null;

/**
 * A small deterministic PRNG. The daily puzzle needs everyone to get the same
 * board from the same date, which `Math.random` cannot give us.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Hash an arbitrary string into a seed for `mulberry32`. */
export const seedFromString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const shuffled = (pool: City[], random: () => number): City[] => {
  const cities = [...pool];
  for (let i = cities.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cities[i], cities[j]] = [cities[j], cities[i]];
  }
  return cities;
};

/** How a round's cities are picked out of the pool. */
export type BoardQuality = "random" | "balanced";

/**
 * A uniform random draw hands one city two or more categories in over 90% of
 * rounds, and three or more in a third of them on the World set. That collapses
 * six decisions into four and makes "pile everything onto the obvious outlier"
 * the whole game, so a balanced draw keeps sampling for a board whose six
 * answers are six different cities.
 *
 * A perfect spread is not always reachable — on a six-city board it is rare, and
 * on a lopsided pool impossible — so the search is capped and falls back to the
 * best board it saw.
 */
const MAX_DRAW_ATTEMPTS = 300;

/** How many distinct cities answer the cards in play, and the worst hoarder. */
const boardShape = (cities: City[], categories: Category[]) => {
  const counts = new Map<string, number>();
  for (const category of categories) {
    const winner = rankCitiesFor(cities, category)[0];
    if (!winner) continue;
    counts.set(winner.id, (counts.get(winner.id) ?? 0) + 1);
  }
  if (counts.size === 0) return { distinct: 0, worst: 0 };
  return { distinct: counts.size, worst: Math.max(...counts.values()) };
};

/**
 * Draw the cities for a round. `balanced` rejection-samples for a board whose
 * six answers are six different cities, keeping the best it found if it cannot
 * get there within the attempt budget.
 */
export const drawBoard = (
  pool: City[],
  count: number = 8,
  quality: BoardQuality = "balanced",
  random: () => number = Math.random,
  categories: Category[] = CORE_CATEGORIES,
): City[] => {
  const size = Math.min(count, pool.length);
  if (quality === "random" || pool.length === 0) {
    return shuffled(pool, random).slice(0, size);
  }

  let best: City[] = [];
  let bestScore = -Infinity;
  // The ideal board answers every card in play with a different city. With more
  // cards than cities that is impossible, so the target is capped accordingly.
  const ideal = Math.min(categories.length, size);

  for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt++) {
    const candidate = shuffled(pool, random).slice(0, size);
    if (candidate.length === 0) return candidate;

    const { distinct, worst } = boardShape(candidate, categories);
    if (distinct >= ideal) {
      return candidate;
    }

    // Otherwise prefer the widest spread, and among equals the board where no
    // single city hoards as many categories.
    const score = distinct * 10 - worst;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
};

/**
 * What to call a city in a given language. Uploaded sets carry one name only,
 * which is then used everywhere.
 */
export const cityName = (
  city: Pick<City, "name" | "nameDe">,
  locale: string,
): string => (locale === "de" && city.nameDe ? city.nameDe : city.name);

/** Format a population for display, e.g. 1_505_814 -> "1.51M". */
export const formatPopulation = (population: number): string => {
  if (population >= 1_000_000) return `${(population / 1_000_000).toFixed(2)}M`;
  if (population >= 10_000) return `${Math.round(population / 1000)}k`;
  return population.toLocaleString("en-US");
};

/** Format a coordinate as degrees with a hemisphere suffix. */
export const formatCoordinate = (
  value: number,
  axis: "lat" | "lon",
): string => {
  const hemisphere =
    axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}° ${hemisphere}`;
};

/** Great-circle distance in kilometres between two points, in degrees. */
export const distanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
};

/**
 * How far a guess was from the right answer, phrased for the card it was played
 * on: kilometres for the compass cards, people, metres or km² for the rest.
 *
 * Returns a message key and its value rather than a sentence, because the
 * player reading it may not be reading English. A city still missing the figure
 * simply has nothing to report.
 */
export const missOf = (
  guessed: PublicCity | City,
  correct: City,
  category: Category,
): { key: string; value: string } | null => {
  if (guessed.id === correct.id) return null;

  const field = CATEGORY_METRIC[category].field;

  if (field === "population") {
    if (guessed.population === null || guessed.population === undefined) return null;
    return {
      key: "miss.people",
      value: formatPopulation(Math.abs(correct.population - guessed.population)),
    };
  }

  if (field === "elevation") {
    if (guessed.elevation === null || guessed.elevation === undefined) return null;
    if (correct.elevation === undefined) return null;
    return {
      key: "miss.metres",
      value: Math.abs(correct.elevation - guessed.elevation).toLocaleString("en-US"),
    };
  }

  if (field === "area") {
    if (guessed.area === null || guessed.area === undefined) return null;
    if (correct.area === undefined) return null;
    return {
      key: "miss.area",
      value: Math.round(Math.abs(correct.area - guessed.area)).toLocaleString("en-US"),
    };
  }

  if (guessed.latitude === null || guessed.longitude === null) return null;
  return {
    key: "miss.km",
    value: distanceKm(
      { latitude: guessed.latitude, longitude: guessed.longitude },
      correct,
    ).toLocaleString("en-US"),
  };
};

/** How a card's answer is evidenced on the results screen. */
export const evidenceOf = (
  category: Category,
  city: PublicCity | City,
): string => {
  switch (CATEGORY_METRIC[category].field) {
    case "latitude":
      return city.latitude === null || city.latitude === undefined
        ? ""
        : formatCoordinate(city.latitude, "lat");
    case "longitude":
      return city.longitude === null || city.longitude === undefined
        ? ""
        : formatCoordinate(city.longitude, "lon");
    case "elevation":
      return city.elevation === null || city.elevation === undefined
        ? ""
        : `${city.elevation.toLocaleString("en-US")} m`;
    case "area":
      return city.area === null || city.area === undefined
        ? ""
        : `${city.area.toLocaleString("en-US")} km²`;
    default:
      return city.population === null || city.population === undefined
        ? ""
        : formatPopulation(city.population);
  }
};
