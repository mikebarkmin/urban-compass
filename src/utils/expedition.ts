import {
  ALL_CATEGORIES,
  Category,
  City,
  categoryField,
  categoryValue,
  distanceKm,
  drawBoard,
  getCorrectAnswers,
  mulberry32,
  rankCitiesFor,
  seedFromString,
} from "../../game/cities";
import { matchingCities, type FilterParams } from "@/data/cityFilter";
import { CONTINENT_BOUNDS, type ContinentKey } from "@/data/regions";
import type { Mark, Picks } from "@/utils/daily";

/**
 * The expedition: a solo run the player configures and can play as often as
 * they like. Unlike the daily there is no shared board and no date — the
 * player picks the cards and the corner of the world, and the boards are drawn
 * on the spot from the gazetteer.
 *
 * Two things make it a game rather than an endless drill. Lives: three, and a
 * round that is not perfect costs one. And the ramp: every round is drawn from
 * a tighter circle than the last, so the compass cards go from "obvious" to
 * "these four cities are within an hour of each other".
 *
 * Everything here is pure. The gazetteer arrives from `loadCities`, the round
 * is a function of the run's seed and its number, and the whole run replays
 * from the seed — which is what makes the share link a challenge rather than a
 * scoreboard.
 */

/** Lives at the start of a run. The third one ending it is the whole tension. */
export const EXPEDITION_LIVES = 3;

/** Cities on a board, matching the daily so the screen reads the same. */
export const EXPEDITION_BOARD_SIZE = 8;

/**
 * How many cities a region is trimmed to, biggest first. One rule that works
 * everywhere: worldwide it is the 4000 best-known cities, and for a country
 * the size of Portugal it is simply all of them.
 */
export const EXPEDITION_POOL_SIZE = 4000;

/** Below this a region cannot sustain a run, and the setup screen says so. */
export const MIN_EXPEDITION_POOL = 12;

/**
 * The cards an expedition can offer. `public/cities5000.json` carries no area
 * column, so the two area cards are simply not on the table — unlike altitude,
 * which the gazetteer does carry (and which narrows the pool, see `buildPool`).
 */
export const EXPEDITION_CATEGORIES: Category[] = ALL_CATEGORIES.filter(
  (category) => categoryField(category) !== "area",
);

/**
 * The population floors the setup screen offers, smallest first. This is the
 * mode's difficulty dial: a high floor keeps the board among cities most people
 * have heard of, while `0` lets in every town the gazetteer carries.
 *
 * On a wide region the low tiers do nothing, because `EXPEDITION_POOL_SIZE`
 * already cuts the world down to its 4,000 biggest cities. They earn their keep
 * on a single country, where the pool is small enough to reach right down to the
 * gazetteer's own 5,000-person floor.
 */
export const EXPEDITION_POP_TIERS = [0, 50_000, 200_000, 1_000_000];

/** The floor a run plays with unless it says otherwise. */
export const DEFAULT_POP_MIN = 0;

/**
 * One card is a legitimate expedition — "only east and west" is exactly the
 * kind of drill this mode is for. The multiplayer floor of three exists
 * because placement pays 3·2·1, which has no meaning on your own.
 */
export const EXPEDITION_MIN_CATEGORIES = 1;

// --- Region ----------------------------------------------------------------

export type RegionChoice =
  | { kind: "world" }
  | { kind: "continent"; key: ContinentKey }
  | { kind: "country"; code: string };

export const WORLD: RegionChoice = { kind: "world" };

/** The filter a region asks of the gazetteer. */
export const regionFilter = (region: RegionChoice): FilterParams => {
  switch (region.kind) {
    case "continent":
      return CONTINENT_BOUNDS[region.key];
    case "country":
      return { countries: [region.code] };
    default:
      return {};
  }
};

/** A region as one token, for the share link and for the per-region record. */
export const regionToken = (region: RegionChoice): string => {
  switch (region.kind) {
    case "continent":
      return `continent.${region.key}`;
    case "country":
      return `country.${region.code}`;
    default:
      return "world";
  }
};

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/** The inverse of `regionToken`. Anything unreadable falls back to the world. */
export const regionFromToken = (value: unknown): RegionChoice | null => {
  if (typeof value !== "string") return null;
  if (value === "world") return WORLD;

  const [kind, rest] = value.split(".");
  if (kind === "continent" && rest && rest in CONTINENT_BOUNDS) {
    return { kind: "continent", key: rest as ContinentKey };
  }
  if (kind === "country" && rest) {
    const code = rest.toUpperCase();
    if (COUNTRY_PATTERN.test(code)) return { kind: "country", code };
  }
  return null;
};

// --- Configuration ---------------------------------------------------------

export interface ExpeditionConfig {
  region: RegionChoice;
  categories: Category[];
  /** Cities smaller than this are left out of the pool. */
  popMin: number;
}

/** A stored or hand-typed floor, snapped to a tier the UI can show. */
export const readPopMin = (value: unknown): number => {
  const wanted = Number(value);
  return EXPEDITION_POP_TIERS.includes(wanted) ? wanted : DEFAULT_POP_MIN;
};

/**
 * One character per card, so a link with eight cards on it is still short
 * enough to paste into a chat.
 */
const CATEGORY_CODES: Partial<Record<Category, string>> = {
  northernmost: "n",
  southernmost: "s",
  easternmost: "e",
  westernmost: "w",
  most_population: "P",
  least_population: "p",
  highest: "h",
  lowest: "l",
};

const CATEGORY_BY_CODE = new Map(
  Object.entries(CATEGORY_CODES).map(([category, code]) => [code, category as Category]),
);

/** A short, URL-safe run id. Not a secret — just something to name a run by. */
export const newSeed = (): string =>
  Math.floor(Math.random() * 0x100000000).toString(36);

/** The query a run is shared as. */
export const runQuery = (
  seed: string,
  config: ExpeditionConfig,
): Record<string, string> => ({
  r: seed,
  region: regionToken(config.region),
  cards: config.categories.map((category) => CATEGORY_CODES[category] ?? "").join(""),
  ...(config.popMin > 0 ? { pop: String(config.popMin) } : {}),
});

/** The link a run is shared as, e.g. `https://…/expedition/?r=k3f9x2&…`. */
export const runUrl = (origin: string, seed: string, config: ExpeditionConfig): string =>
  `${origin}/expedition/?${new URLSearchParams(runQuery(seed, config)).toString()}`;

/**
 * Read a run out of the URL. A link that is missing a piece, or carries a
 * region or a card the app does not know, is treated as no link at all — the
 * player lands on the setup screen rather than on an error.
 */
export const runFromQuery = (
  query: Record<string, string | string[] | undefined>,
): { seed: string; config: ExpeditionConfig } | null => {
  const seed = query.r;
  const region = regionFromToken(query.region);
  const cards = query.cards;
  if (typeof seed !== "string" || !seed || !region || typeof cards !== "string") return null;

  const categories: Category[] = [];
  for (const code of cards) {
    const category = CATEGORY_BY_CODE.get(code);
    if (category && !categories.includes(category)) categories.push(category);
  }
  if (categories.length < EXPEDITION_MIN_CATEGORIES) return null;

  // A link written before the floor existed simply has no `pop`, which reads
  // back as the default rather than as a broken link.
  return {
    seed: seed.slice(0, 16),
    config: { region, categories, popMin: readPopMin(query.pop) },
  };
};

// --- The pool --------------------------------------------------------------

/** Whether a set of cards needs every city to carry an elevation. */
export const needsElevation = (categories: Category[]): boolean =>
  categories.some((category) => categoryField(category) === "elevation");

/**
 * The cities a run draws from: the region's cities, trimmed to the biggest
 * `EXPEDITION_POOL_SIZE` of them.
 *
 * The altitude cards force a second filter. GeoNames leaves elevation null for
 * a fair number of rows, and a pool where half the cities have no reading
 * would quietly hand "lowest" to whichever city was missing one — so when an
 * altitude card is in play, cities without a figure leave the pool entirely
 * rather than sitting on the board as a trap.
 */
export const buildPool = (cities: City[], config: ExpeditionConfig): City[] => {
  let pool = matchingCities(cities, {
    ...regionFilter(config.region),
    popMin: config.popMin,
  });
  if (needsElevation(config.categories)) {
    pool = pool.filter((city) => typeof city.elevation === "number");
  }
  if (pool.length <= EXPEDITION_POOL_SIZE) return pool;
  return [...pool]
    .sort((a, b) => b.population - a.population)
    .slice(0, EXPEDITION_POOL_SIZE);
};

// --- The ramp --------------------------------------------------------------

/** How much of the previous round's circle the next one keeps. */
const RADIUS_DECAY = 0.72;

/** The tightest a board gets: eight cities inside an hour's drive. */
export const MIN_RADIUS_KM = 60;

/**
 * Round one's radius: half the diagonal of the region's bounding box, so the
 * first board spans whatever the player chose and the ramp has somewhere to
 * come down from. Floored, so a city-state still plays.
 */
export const startRadiusKm = (pool: City[]): number => {
  if (pool.length === 0) return MIN_RADIUS_KM;

  let latMin = 90;
  let latMax = -90;
  let lonMin = 180;
  let lonMax = -180;
  for (const city of pool) {
    if (city.latitude < latMin) latMin = city.latitude;
    if (city.latitude > latMax) latMax = city.latitude;
    if (city.longitude < lonMin) lonMin = city.longitude;
    if (city.longitude > lonMax) lonMax = city.longitude;
  }

  const diagonal = distanceKm(
    { latitude: latMin, longitude: lonMin },
    { latitude: latMax, longitude: lonMax },
  );
  return Math.max(diagonal / 2, MIN_RADIUS_KM * 4);
};

/** The circle round `number` is drawn from, closing in on `MIN_RADIUS_KM`. */
export const radiusKm = (number: number, start: number): number =>
  Math.max(MIN_RADIUS_KM, start * RADIUS_DECAY ** Math.max(0, number - 1));

// --- Drawing a round -------------------------------------------------------

export interface ExpeditionRound {
  number: number;
  /** The circle this board was drawn from, shown so the ramp is visible. */
  radiusKm: number;
  cities: City[];
  answers: Partial<Record<Category, City>>;
  /** The city that came second — a "so close" rather than a miss. */
  runnersUp: Partial<Record<Category, City | null>>;
}

/** How many anchors to try before widening the circle. */
const ANCHOR_ATTEMPTS = 30;

/** How many times the circle may be widened before the best board is taken. */
const MAX_WIDENINGS = 6;

/**
 * Whether a board is playable: no two cities sharing a name (the board shows a
 * name and nothing else), and no card decided by a tie. The same two bars
 * `scripts/check-daily.mjs` holds the authored dailies to.
 */
const boardIsPlayable = (cities: City[], categories: Category[]): boolean => {
  const names = new Set<string>();
  for (const city of cities) {
    const key = city.name.toLowerCase();
    if (names.has(key)) return false;
    names.add(key);
  }

  for (const category of categories) {
    const ranked = rankCitiesFor(cities, category);
    if (ranked.length < 2) return false;
    if (categoryValue(ranked[0], category) === categoryValue(ranked[1], category)) return false;
  }

  return true;
};

const toRound = (
  number: number,
  radius: number,
  cities: City[],
  categories: Category[],
): ExpeditionRound => {
  const runnersUp: Partial<Record<Category, City | null>> = {};
  for (const category of categories) {
    runnersUp[category] = rankCitiesFor(cities, category)[1] ?? null;
  }
  return {
    number,
    radiusKm: Math.round(radius),
    cities,
    answers: getCorrectAnswers(cities, categories),
    runnersUp,
  };
};

/**
 * Draw one round: pick an anchor city, take everything within this round's
 * radius of it, and deal a balanced board out of that.
 *
 * A tight circle over an empty stretch of map has nothing in it, so a failed
 * anchor is simply retried; only when a whole batch of anchors comes up short
 * does the circle widen. A sparse region therefore degrades to a wider board
 * rather than to no board at all, and the run never stalls.
 */
export const buildExpeditionRound = (
  pool: City[],
  start: number,
  categories: Category[],
  number: number,
  random: () => number,
): ExpeditionRound => {
  let radius = radiusKm(number, start);
  let fallback: City[] | null = null;

  for (let widening = 0; widening <= MAX_WIDENINGS; widening++) {
    for (let attempt = 0; attempt < ANCHOR_ATTEMPTS; attempt++) {
      const anchor = pool[Math.floor(random() * pool.length)];
      if (!anchor) break;

      const candidates = pool.filter((city) => distanceKm(anchor, city) <= radius);
      if (candidates.length < EXPEDITION_BOARD_SIZE) continue;

      const board = drawBoard(
        candidates,
        EXPEDITION_BOARD_SIZE,
        "balanced",
        random,
        categories,
      );
      if (!fallback) fallback = board;
      if (boardIsPlayable(board, categories)) return toRound(number, radius, board, categories);
    }
    radius *= 1.5;
  }

  // Nothing clean was found — the region is small or lopsided enough that a
  // wider board is the honest answer. The last resort is the whole pool, which
  // is only reached when the pool itself is barely bigger than a board.
  return toRound(
    number,
    radius,
    fallback ?? pool.slice(0, EXPEDITION_BOARD_SIZE),
    categories,
  );
};

/** Rebuild round `number` of a run. Pure: the seed and the number decide it. */
export const roundFor = (
  pool: City[],
  start: number,
  config: ExpeditionConfig,
  seed: string,
  number: number,
): ExpeditionRound =>
  buildExpeditionRound(
    pool,
    start,
    config.categories,
    number,
    mulberry32(seedFromString(`urban-compass/expedition/${seed}/${number}`)),
  );

// --- Grading ---------------------------------------------------------------

export const markFor = (
  round: ExpeditionRound,
  category: Category,
  cityId: string | undefined,
): Mark => {
  if (!cityId) return "miss";
  if (round.answers[category]?.id === cityId) return "hit";
  if (round.runnersUp[category]?.id === cityId) return "close";
  return "miss";
};

/** How many cards this round was right. */
export const roundHits = (
  round: ExpeditionRound,
  categories: Category[],
  picks: Picks,
): number =>
  categories.filter((category) => markFor(round, category, picks[category]) === "hit").length;

// --- A run -----------------------------------------------------------------

/** What one finished round is remembered as, for the share row. */
export interface RoundRecord {
  number: number;
  hits: number;
  total: number;
  perfect: boolean;
}

export interface ExpeditionRun {
  seed: string;
  config: ExpeditionConfig;
  /** The round on screen, 1-based. */
  round: number;
  lives: number;
  /** Every round already played out. */
  history: RoundRecord[];
  /** Cards right, and cards played, across the whole run. */
  hits: number;
  cards: number;
  /** This round's placements, and whether it has been revealed. */
  picks: Picks;
  revealed: boolean;
  over: boolean;
}

export const startRun = (seed: string, config: ExpeditionConfig): ExpeditionRun => ({
  seed,
  config,
  round: 1,
  lives: EXPEDITION_LIVES,
  history: [],
  hits: 0,
  cards: 0,
  picks: {},
  revealed: false,
  over: false,
});

/**
 * Reveal the round on screen and settle it. A round is perfect or it is not —
 * anything short of every card costs a life, which is what makes the ramp
 * bite. The hits are still counted, so a 5/6 round reads differently from a
 * 1/6 even though both cost the same.
 */
export const revealRound = (run: ExpeditionRun, round: ExpeditionRound): ExpeditionRun => {
  if (run.revealed || run.over) return run;

  const total = run.config.categories.length;
  const hits = roundHits(round, run.config.categories, run.picks);
  const perfect = hits === total;
  const lives = perfect ? run.lives : run.lives - 1;

  return {
    ...run,
    revealed: true,
    lives,
    over: lives <= 0,
    hits: run.hits + hits,
    cards: run.cards + total,
    history: [...run.history, { number: run.round, hits, total, perfect }],
  };
};

/** Deal the next round. A finished run stays finished. */
export const nextRound = (run: ExpeditionRun): ExpeditionRun =>
  run.over || !run.revealed
    ? run
    : { ...run, round: run.round + 1, picks: {}, revealed: false };

/** How deep the run got — the round it died on. */
export const roundsReached = (run: ExpeditionRun): number =>
  run.history.length || run.round;

// --- Persistence -----------------------------------------------------------

const STORAGE_KEY = "urban-compass:expedition";

export interface ExpeditionStats {
  runs: number;
  totalRounds: number;
  /** The deepest run anywhere. */
  best: number;
  /** The deepest run per region token, so each corner keeps its own record. */
  bestByRegion: Record<string, number>;
  /**
   * The run in progress. Unlike the daily, an expedition is restored on
   * reload: a run can be a dozen rounds long, and losing one to a refresh is
   * not a trade worth making.
   */
  active: ExpeditionRun | null;
}

export const emptyExpeditionStats = (): ExpeditionStats => ({
  runs: 0,
  totalRounds: 0,
  best: 0,
  bestByRegion: {},
  active: null,
});

/** A stored region, which is written as a token but was once an object. */
const regionTokenOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const region = value as { kind?: unknown; key?: unknown; code?: unknown };
    if (region.kind === "world") return "world";
    if (region.kind === "continent" && typeof region.key === "string") {
      return `continent.${region.key}`;
    }
    if (region.kind === "country" && typeof region.code === "string") {
      return `country.${region.code}`;
    }
  }
  return null;
};

const readRun = (value: unknown): ExpeditionRun | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const seed = typeof raw.seed === "string" ? raw.seed : null;
  const config = raw.config as
    | { region?: unknown; categories?: unknown; popMin?: unknown }
    | undefined;
  const region = regionFromToken(regionTokenOf(config?.region));
  if (!seed || !region || !Array.isArray(config?.categories)) return null;

  const categories = (config.categories as unknown[]).filter(
    (category): category is Category =>
      typeof category === "string" && EXPEDITION_CATEGORIES.includes(category as Category),
  );
  if (categories.length < EXPEDITION_MIN_CATEGORIES) return null;

  const history = Array.isArray(raw.history)
    ? (raw.history as unknown[]).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        return [
          {
            number: Number(record.number) || 0,
            hits: Number(record.hits) || 0,
            total: Number(record.total) || categories.length,
            perfect: record.perfect === true,
          },
        ];
      })
    : [];

  return {
    seed,
    config: { region, categories, popMin: readPopMin(config.popMin) },
    round: Math.max(1, Number(raw.round) || 1),
    lives: Math.min(EXPEDITION_LIVES, Math.max(0, Number(raw.lives) || 0)),
    history,
    hits: Number(raw.hits) || 0,
    cards: Number(raw.cards) || 0,
    picks: (raw.picks && typeof raw.picks === "object" ? raw.picks : {}) as Picks,
    revealed: raw.revealed === true,
    over: raw.over === true,
  };
};

/**
 * Read the saved record. Anything unreadable — a private window, storage
 * switched off, a value from an older shape — is a clean slate rather than an
 * error, the way the daily's stats are read.
 */
export const loadExpeditionStats = (): ExpeditionStats => {
  if (typeof window === "undefined") return emptyExpeditionStats();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyExpeditionStats();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const bestByRegion: Record<string, number> = {};
    if (parsed.bestByRegion && typeof parsed.bestByRegion === "object") {
      for (const [token, value] of Object.entries(parsed.bestByRegion as Record<string, unknown>)) {
        const rounds = Number(value);
        if (Number.isFinite(rounds) && rounds > 0) bestByRegion[token] = Math.floor(rounds);
      }
    }

    return {
      runs: Number(parsed.runs) || 0,
      totalRounds: Number(parsed.totalRounds) || 0,
      best: Number(parsed.best) || 0,
      bestByRegion,
      active: readRun(parsed.active),
    };
  } catch {
    return emptyExpeditionStats();
  }
};

export const saveExpeditionStats = (stats: ExpeditionStats): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(stats)));
  } catch {
    // Storage being unavailable costs the record, not the run.
  }
};

/** Regions are stored as their token, so the file stays readable. */
const serialize = (stats: ExpeditionStats) => ({
  ...stats,
  active: stats.active && {
    ...stats.active,
    config: {
      region: regionToken(stats.active.config.region),
      categories: stats.active.config.categories,
      popMin: stats.active.config.popMin,
    },
  },
});

/** Fold a finished run into the record. */
export const recordRun = (stats: ExpeditionStats, run: ExpeditionRun): ExpeditionStats => {
  const rounds = roundsReached(run);
  const token = regionToken(run.config.region);

  return {
    runs: stats.runs + 1,
    totalRounds: stats.totalRounds + rounds,
    best: Math.max(stats.best, rounds),
    bestByRegion: {
      ...stats.bestByRegion,
      [token]: Math.max(stats.bestByRegion[token] ?? 0, rounds),
    },
    active: null,
  };
};

// --- Sharing ---------------------------------------------------------------

/** One square per round: green survived it, red spent a life on it. */
const ROUND_SQUARES = { perfect: "🟩", lost: "🟥" };

/**
 * The share card. One square per round keeps it to three lines however long
 * the run was, and the link carries the seed and the settings — so whoever
 * opens it plays the same expedition rather than a different one with the same
 * name.
 */
export const shareText = (
  run: ExpeditionRun,
  regionLabel: string,
  origin?: string,
): string => {
  const squares = run.history
    .map((record) => (record.perfect ? ROUND_SQUARES.perfect : ROUND_SQUARES.lost))
    .join("");

  const lines = [
    `Urban Compass · Expedition — ${regionLabel}`,
    `Round ${roundsReached(run)} · ${run.hits}/${run.cards} cards`,
    squares,
  ];
  if (origin) lines.push(runUrl(origin, run.seed, run.config));
  return lines.join("\n");
};
