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
import {
  CONTINENT_COUNTRIES,
  EUROPE_LONGITUDES,
  type ContinentKey,
} from "@/data/regions";
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

/**
 * One compass and one second wind per run.
 *
 * Pushing asks "do you know the next card"; a lifeline asks "is this the round
 * to spend it on", which is the decision that makes a deep stack worth
 * defending rather than merely lucky. One of each is deliberately stingy: two
 * would make every round survivable and there would be nothing to weigh.
 */
export const EXPEDITION_LIFELINES = 1;

/** How many cities the compass strikes off the board. */
export const COMPASS_STRIKES = 3;

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

/**
 * The filter a region asks of the gazetteer.
 *
 * A continent is its countries, not its bounding box. The box that used to
 * stand in for Europe reached far enough east and south to sweep in Aleppo,
 * Tel Aviv and Casablanca, which is a fine way to lose a run on a card you
 * answered correctly. Europe alone keeps a longitude window on top of the
 * country list, to cut Russia at the Urals — see `EUROPE_LONGITUDES`.
 */
export const regionFilter = (region: RegionChoice): FilterParams => {
  switch (region.kind) {
    case "continent":
      return {
        countries: CONTINENT_COUNTRIES[region.key],
        ...(region.key === "europe" ? EUROPE_LONGITUDES : {}),
      };
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
  if (kind === "continent" && rest && rest in CONTINENT_COUNTRIES) {
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

/**
 * What the sender got, carried on the link. A shared expedition already deals
 * the same cards in the same order, so the only thing missing to make it a
 * challenge rather than a copy is what happened to them.
 *
 * `rounds` is what turns a target into a race: with their round-by-round beside
 * yours, a run stops being one number at the end and becomes a thing you are
 * ahead or behind in, round by round, while you play it.
 */
export interface Challenge {
  round: number;
  score: number;
  /** How each of their rounds ended, oldest first. */
  rounds: RoundEnding[];
}

/** One character per round, so a long run still fits in a pasteable link. */
const ENDING_CODES: Record<RoundEnding, string> = {
  banked: "b",
  close: "c",
  bust: "x",
};

const ENDING_BY_CODE = new Map(
  Object.entries(ENDING_CODES).map(([ending, code]) => [code, ending as RoundEnding]),
);

/** A run long enough to overflow this is long enough to be summarised. */
const MAX_SHARED_ROUNDS = 80;

/** The query a run is shared as. */
export const runQuery = (
  seed: string,
  config: ExpeditionConfig,
  challenge?: Challenge | null,
): Record<string, string> => ({
  r: seed,
  region: regionToken(config.region),
  cards: config.categories.map((category) => CATEGORY_CODES[category] ?? "").join(""),
  ...(config.popMin > 0 ? { pop: String(config.popMin) } : {}),
  ...(challenge
    ? {
        d: String(challenge.round),
        s: String(challenge.score),
        ...(challenge.rounds.length > 0
          ? {
              h: challenge.rounds
                .slice(0, MAX_SHARED_ROUNDS)
                .map((ending) => ENDING_CODES[ending])
                .join(""),
            }
          : {}),
      }
    : {}),
});

/** The link a run is shared as, e.g. `https://…/expedition/?r=k3f9x2&…`. */
export const runUrl = (
  origin: string,
  seed: string,
  config: ExpeditionConfig,
  challenge?: Challenge | null,
): string =>
  `${origin}/expedition/?${new URLSearchParams(runQuery(seed, config, challenge)).toString()}`;

/**
 * Read a run out of the URL. A link that is missing a piece, or carries a
 * region or a card the app does not know, is treated as no link at all — the
 * player lands on the setup screen rather than on an error.
 */
export const runFromQuery = (
  query: Record<string, string | string[] | undefined>,
): { seed: string; config: ExpeditionConfig; challenge: Challenge | null } | null => {
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
  // back as the default rather than as a broken link. The same goes for a
  // plain share link with no result on it: no challenge, just the expedition.
  const round = Number(query.d);
  const score = Number(query.s);
  const rounds =
    typeof query.h === "string"
      ? [...query.h.slice(0, MAX_SHARED_ROUNDS)].flatMap((code) => {
          const ending = ENDING_BY_CODE.get(code);
          return ending ? [ending] : [];
        })
      : [];
  const challenge =
    Number.isFinite(round) && round > 0
      ? {
          round: Math.floor(round),
          score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
          rounds,
        }
      : null;

  return {
    seed: seed.slice(0, 16),
    config: { region, categories, popMin: readPopMin(query.pop) },
    challenge,
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

/**
 * The round the circle first sits at `MIN_RADIUS_KM` — the summit, and the
 * point a run stops being a survival streak and becomes something you beat.
 * It lands around round 9 on a mid-sized country and round 17 worldwide, so
 * every region has a finish line the player can actually name.
 */
export const summitRound = (start: number): number => {
  if (start <= MIN_RADIUS_KM) return 1;
  return Math.ceil(Math.log(MIN_RADIUS_KM / start) / Math.log(RADIUS_DECAY)) + 1;
};

/**
 * Past the summit the circle cannot close any further, so the ramp switches
 * axis: obscurity takes over from proximity. Each round beyond the summit caps
 * the board at a smaller city than the last, until it is drawing from the towns
 * at the bottom of the gazetteer.
 */
export const OBSCURITY_TIERS = [1_000_000, 200_000, 50_000, 20_000, 5_000];

/**
 * The largest city round `number` will put on the board, or `null` while the
 * circle is still doing the work. A ceiling is a preference, not a promise —
 * `buildExpeditionRound` drops it rather than fail to fill a board.
 */
export const popCeiling = (number: number, start: number): number | null => {
  const past = number - summitRound(start);
  if (past < 0) return null;
  return OBSCURITY_TIERS[Math.min(past, OBSCURITY_TIERS.length - 1)];
};

// --- Drawing a round -------------------------------------------------------

export interface ExpeditionRound {
  number: number;
  /** The circle this board was drawn from, shown so the ramp is visible. */
  radiusKm: number;
  cities: City[];
  answers: Partial<Record<Category, City>>;
  /** The city that came second — a "so close" rather than a miss. */
  runnersUp: Partial<Record<Category, City | null>>;
  /** The population cap this board was drawn under, once past the summit. */
  popCeiling: number | null;
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
  ceiling: number | null = null,
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
    popCeiling: ceiling,
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
  const ceiling = popCeiling(number, start);
  let fallback: City[] | null = null;
  // Whether the board actually honoured the ceiling, so the screen only claims
  // an obscurity tier the player is really looking at.
  let heldCeiling = false;

  for (let widening = 0; widening <= MAX_WIDENINGS; widening++) {
    for (let attempt = 0; attempt < ANCHOR_ATTEMPTS; attempt++) {
      const anchor = pool[Math.floor(random() * pool.length)];
      if (!anchor) break;

      const near = pool.filter((city) => distanceKm(anchor, city) <= radius);
      // Past the summit the board prefers the smaller cities inside the circle,
      // but a ceiling that cannot fill a board is dropped rather than obeyed:
      // a thin one is what widened the circle in the first place.
      const humble =
        ceiling === null ? near : near.filter((city) => city.population <= ceiling);
      const enough = humble.length >= EXPEDITION_BOARD_SIZE;
      const candidates = enough ? humble : near;
      if (candidates.length < EXPEDITION_BOARD_SIZE) continue;

      const board = drawBoard(
        candidates,
        EXPEDITION_BOARD_SIZE,
        "balanced",
        random,
        categories,
      );
      if (!fallback) fallback = board;
      if (boardIsPlayable(board, categories)) {
        return toRound(number, radius, board, categories, enough ? ceiling : null);
      }
      heldCeiling = heldCeiling || enough;
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
    heldCeiling ? ceiling : null,
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

/**
 * A graded placement, with enough detail to say *how* wrong it was. A bare red
 * cross teaches nothing; "4th of 8, 340 m below" is the thing that makes the
 * next board easier, so the screen always has the rank and the gap to hand.
 */
export interface CardVerdict {
  mark: Mark;
  /** Where the pick placed in the order this card asks for, 1-based. */
  rank: number | null;
  /** Cities on the board, so "4th of 8" reads without a second lookup. */
  of: number;
}

export const cardVerdict = (
  round: ExpeditionRound,
  category: Category,
  cityId: string | undefined,
): CardVerdict => {
  const mark = markFor(round, category, cityId);
  const ranked = rankCitiesFor(round.cities, category);
  const of = ranked.length;
  if (!cityId) return { mark, rank: null, of };

  const index = ranked.findIndex((city) => city.id === cityId);
  return { mark, rank: index < 0 ? null : index + 1, of };
};

// --- A run -----------------------------------------------------------------

/**
 * How a round finished. Banking and a near miss both keep the life; only a
 * clean miss spends one. The difference between `close` and `bust` is the
 * whole reason the board bothers working out a runner-up.
 */
export type RoundEnding = "banked" | "close" | "bust";

/** Where a round stands while it is being played. */
export type RoundPhase =
  | "placing" /** A card is on the table waiting for a city. */
  | "crossroads" /** The card was right: bank the round, or draw another. */
  | "ended"; /** Settled, waiting to deal the next one. */

/** What one finished round is remembered as, for the share row. */
export interface RoundRecord {
  number: number;
  /** Cards taken cleanly. */
  hits: number;
  /** Cards drawn — how far the player pushed. */
  total: number;
  /** Whether the round was left without spending a life. */
  perfect: boolean;
  ending: RoundEnding;
  /** Points the round was worth. */
  score: number;
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
  /** Points banked across the run. Pushing is what makes this grow. */
  score: number;
  /** The round the circle bottoms out — this run's finish line. */
  summitAt: number;
  /** Whether the run has reached it. */
  summited: boolean;
  /** This round's placements. */
  picks: Picks;
  /** The cards drawn this round, oldest first. The last one is in play. */
  draws: Category[];
  /** How many of `draws` have been graded. */
  settled: number;
  phase: RoundPhase;
  /** How the round ended, once `phase` is "ended". */
  ending: RoundEnding | null;
  /** Lifelines left. Spent, never bought — except at the summit. */
  compass: number;
  secondWind: number;
  /** Cities the compass has struck off for the card in play. */
  struck: string[];
  over: boolean;
}

/**
 * What a round of `n` banked cards is worth. Triangular, so each extra card
 * is worth more than the one before it — 1, 3, 6, 10, 15, 21. A flat score
 * would make pushing a coin toss; this makes it a temptation.
 */
export const roundScore = (streak: number): number => (streak * (streak + 1)) / 2;

/** What the next card would add, if it lands. Shown on the push button. */
export const pushValue = (streak: number): number => roundScore(streak + 1) - roundScore(streak);

/**
 * Draw one card for a round. Seeded on the run, the round and the position in
 * it, so a shared link deals the same cards in the same order — and a card
 * already drawn this round cannot come back around.
 */
export const drawCard = (
  seed: string,
  round: number,
  index: number,
  categories: Category[],
  taken: Category[] = [],
): Category => {
  const available = categories.filter((category) => !taken.includes(category));
  const from = available.length > 0 ? available : categories;
  const rng = mulberry32(seedFromString(`urban-compass/expedition/${seed}/card/${round}/${index}`));
  return from[Math.floor(rng() * from.length)];
};

/** The card waiting for a city, if the round is at that point. */
export const cardInPlay = (run: ExpeditionRun): Category | null =>
  run.phase === "placing" && run.draws.length > 0 ? run.draws[run.draws.length - 1] : null;

/** The card just graded, if the round is showing a result. */
export const lastCard = (run: ExpeditionRun): Category | null =>
  run.draws.length > 0 ? run.draws[run.draws.length - 1] : null;

/** Whether there is another card left in the set to push for. */
export const canPush = (run: ExpeditionRun): boolean =>
  run.phase === "crossroads" && run.draws.length < run.config.categories.length;

export const startRun = (
  seed: string,
  config: ExpeditionConfig,
  startRadius: number,
): ExpeditionRun => {
  const summitAt = summitRound(startRadius);
  return {
    seed,
    config,
    round: 1,
    lives: EXPEDITION_LIVES,
    history: [],
    hits: 0,
    cards: 0,
    score: 0,
    summitAt,
    summited: summitAt <= 1,
    picks: {},
    draws: [drawCard(seed, 1, 0, config.categories)],
    settled: 0,
    phase: "placing",
    ending: null,
    compass: EXPEDITION_LIFELINES,
    secondWind: EXPEDITION_LIFELINES,
    struck: [],
    over: false,
  };
};

/**
 * Grade the card on the table.
 *
 * A hit leaves the round open at the crossroads — bank what is on the table,
 * or draw one more for a card that is worth more than the last. A runner-up
 * ends the round but costs nothing: the streak is banked and the life is kept,
 * which is what makes "so close" feel like a let-off rather than a cheat. Only
 * a clean miss takes the round's whole stack and a life with it.
 */
export const settleCard = (run: ExpeditionRun, round: ExpeditionRound): ExpeditionRun => {
  const card = cardInPlay(run);
  if (!card || run.over) return run;

  const mark = markFor(round, card, run.picks[card]);
  const settled = run.settled + 1;
  const base = { ...run, settled, cards: run.cards + 1 };

  if (mark === "hit") {
    return { ...base, hits: run.hits + 1, phase: "crossroads", ending: null };
  }

  const streak = run.settled;
  const kept = mark === "close";
  const earned = kept ? roundScore(streak) : 0;
  const lives = kept ? run.lives : run.lives - 1;

  return {
    ...base,
    lives,
    over: lives <= 0,
    score: run.score + earned,
    phase: "ended",
    ending: kept ? "close" : "bust",
    history: [
      ...run.history,
      {
        number: run.round,
        hits: streak,
        total: settled,
        perfect: kept,
        ending: kept ? "close" : "bust",
        score: earned,
      },
    ],
  };
};

/** Whether the compass can still be spent on the card in play. */
export const canCompass = (run: ExpeditionRun): boolean =>
  run.phase === "placing" && run.compass > 0 && run.struck.length === 0 && !run.over;

/**
 * Spend the compass: strike `COMPASS_STRIKES` wrong cities off the board for
 * the card in play, leaving the answer and a thinner field behind.
 *
 * Seeded on the run, the round and the card, so a shared expedition strikes the
 * same cities for whoever spends it — a lifeline must not quietly hand two
 * players different boards. A placement already sitting on a struck city is
 * lifted, since the point is to be told it was wrong.
 */
export const spendCompass = (run: ExpeditionRun, round: ExpeditionRound): ExpeditionRun => {
  const card = cardInPlay(run);
  if (!card || !canCompass(run)) return run;

  const answer = round.answers[card];
  const wrong = round.cities.filter((city) => city.id !== answer?.id);
  const rng = mulberry32(
    seedFromString(`urban-compass/expedition/${run.seed}/compass/${run.round}/${run.draws.length}`),
  );
  // Fisher-Yates as far as we need, so the draw is uniform over the wrong
  // cities rather than biased towards the front of the board.
  const pool = [...wrong];
  const struck: string[] = [];
  for (let i = 0; i < COMPASS_STRIKES && pool.length > 0; i++) {
    const [city] = pool.splice(Math.floor(rng() * pool.length), 1);
    struck.push(city.id);
  }

  const picks = { ...run.picks };
  if (struck.includes(picks[card] ?? "")) delete picks[card];

  return { ...run, compass: run.compass - 1, struck, picks };
};

/**
 * Whether the round can still be pulled back out of a bust.
 *
 * Not on the last life. A second wind that could undo the final bust would be
 * a resurrection, and the run would already have been folded into the record
 * by the time it was offered. Losing it to a fatal bust is the point: hold it
 * too long and it dies with you, which is what makes spending it a decision
 * rather than a formality.
 */
export const canSecondWind = (run: ExpeditionRun): boolean =>
  run.phase === "ended" && run.ending === "bust" && run.secondWind > 0 && !run.over;

/**
 * Spend the second wind: rewind the card that busted.
 *
 * The life comes back, the stack comes back, and the card returns to the table
 * with the placement lifted — so what the player keeps is the knowledge that
 * their first answer was wrong. It rescues a bust and nothing else: a near miss
 * already keeps both the life and the score, and letting it be rewound too
 * would collapse the distinction the runner-up exists to draw.
 */
export const spendSecondWind = (run: ExpeditionRun): ExpeditionRun => {
  const card = lastCard(run);
  if (!card || !canSecondWind(run)) return run;

  const picks = { ...run.picks };
  delete picks[card];

  return {
    ...run,
    secondWind: run.secondWind - 1,
    lives: run.lives + 1,
    over: false,
    settled: run.settled - 1,
    cards: run.cards - 1,
    history: run.history.slice(0, -1),
    picks,
    // The strikes stay. The compass was already spent on this card, and taking
    // its answer back with the placement would charge for it twice.
    phase: "placing",
    ending: null,
  };
};

/** Take the round's stack and walk away from the board. */
export const bankRound = (run: ExpeditionRun): ExpeditionRun => {
  if (run.phase !== "crossroads" || run.over) return run;
  const streak = run.settled;
  const earned = roundScore(streak);

  return {
    ...run,
    score: run.score + earned,
    phase: "ended",
    ending: "banked",
    history: [
      ...run.history,
      {
        number: run.round,
        hits: streak,
        total: run.draws.length,
        perfect: true,
        ending: "banked",
        score: earned,
      },
    ],
  };
};

/** Stay at the board and turn one more card over. */
export const pushLuck = (run: ExpeditionRun): ExpeditionRun => {
  if (!canPush(run)) return run;
  const next = drawCard(
    run.seed,
    run.round,
    run.draws.length,
    run.config.categories,
    run.draws,
  );
  return {
    ...run,
    draws: [...run.draws, next],
    phase: "placing",
    ending: null,
    struck: [],
  };
};

/** Deal the next round. A finished run stays finished. */
export const nextRound = (run: ExpeditionRun): ExpeditionRun => {
  if (run.over || run.phase !== "ended") return run;
  const number = run.round + 1;

  // Cresting the summit hands back a fresh set of lifelines. The circle stops
  // closing there and obscurity takes over, so the second half of a run is a
  // different climb — and it deserves to start equipped.
  const cresting = !run.summited && number >= run.summitAt;

  return {
    ...run,
    round: number,
    picks: {},
    draws: [drawCard(run.seed, number, 0, run.config.categories)],
    settled: 0,
    phase: "placing",
    ending: null,
    struck: [],
    compass: cresting ? EXPEDITION_LIFELINES : run.compass,
    secondWind: cresting ? EXPEDITION_LIFELINES : run.secondWind,
    summited: run.summited || cresting,
  };
};

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
  /** The best score banked anywhere, and per region. */
  bestScore: number;
  bestScoreByRegion: Record<string, number>;
  /**
   * Every region whose summit has been reached. This is the conquest map: an
   * endless mode needs somewhere to put a finished run, and "which corners of
   * the world have you topped" is a better answer than one high score.
   */
  summited: string[];
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
  bestScore: 0,
  bestScoreByRegion: {},
  summited: [],
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

const ENDINGS: RoundEnding[] = ["banked", "close", "bust"];

const clampLifeline = (value: unknown): number =>
  value === undefined
    ? EXPEDITION_LIFELINES
    : Math.min(EXPEDITION_LIFELINES, Math.max(0, Number(value) || 0));
const PHASES: RoundPhase[] = ["placing", "crossroads", "ended"];

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
        const ending = ENDINGS.includes(record.ending as RoundEnding)
          ? (record.ending as RoundEnding)
          : record.perfect === true
            ? "banked"
            : "bust";
        return [
          {
            number: Number(record.number) || 0,
            hits: Number(record.hits) || 0,
            total: Number(record.total) || 1,
            perfect: record.perfect === true,
            ending,
            score: Number(record.score) || 0,
          },
        ];
      })
    : [];

  const round = Math.max(1, Number(raw.round) || 1);

  // A run saved before the round became a stack has no `draws`; it reads back
  // as a fresh placing phase for the same round, which is the honest way to
  // resume it and costs the player nothing they had banked.
  const draws = Array.isArray(raw.draws)
    ? (raw.draws as unknown[]).filter(
        (card): card is Category =>
          typeof card === "string" && categories.includes(card as Category),
      )
    : [];
  const dealt = draws.length > 0 ? draws : [drawCard(seed, round, 0, categories)];
  const settled = Math.min(dealt.length, Math.max(0, Number(raw.settled) || 0));
  const phase = PHASES.includes(raw.phase as RoundPhase)
    ? (raw.phase as RoundPhase)
    : settled < dealt.length
      ? "placing"
      : "crossroads";
  const summitAt = Math.max(1, Number(raw.summitAt) || 1);

  return {
    seed,
    config: { region, categories, popMin: readPopMin(config.popMin) },
    round,
    lives: Math.min(EXPEDITION_LIVES, Math.max(0, Number(raw.lives) || 0)),
    history,
    hits: Number(raw.hits) || 0,
    cards: Number(raw.cards) || 0,
    score: Number(raw.score) || 0,
    summitAt,
    summited: raw.summited === true || round >= summitAt,
    picks: (raw.picks && typeof raw.picks === "object" ? raw.picks : {}) as Picks,
    draws: dealt,
    settled,
    phase,
    ending: ENDINGS.includes(raw.ending as RoundEnding) ? (raw.ending as RoundEnding) : null,
    // A run saved before lifelines existed reads back with a full set rather
    // than none: the generous reading is the one that cannot lose a player
    // something they had.
    compass: clampLifeline(raw.compass),
    secondWind: clampLifeline(raw.secondWind),
    struck: Array.isArray(raw.struck)
      ? (raw.struck as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
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

    const bestScoreByRegion: Record<string, number> = {};
    if (parsed.bestScoreByRegion && typeof parsed.bestScoreByRegion === "object") {
      for (const [token, value] of Object.entries(
        parsed.bestScoreByRegion as Record<string, unknown>,
      )) {
        const score = Number(value);
        if (Number.isFinite(score) && score > 0) bestScoreByRegion[token] = Math.floor(score);
      }
    }

    const summited = Array.isArray(parsed.summited)
      ? (parsed.summited as unknown[]).filter(
          (token): token is string => typeof token === "string" && !!regionFromToken(token),
        )
      : [];

    return {
      runs: Number(parsed.runs) || 0,
      totalRounds: Number(parsed.totalRounds) || 0,
      best: Number(parsed.best) || 0,
      bestByRegion,
      bestScore: Number(parsed.bestScore) || 0,
      bestScoreByRegion,
      summited,
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
    ...stats,
    runs: stats.runs + 1,
    totalRounds: stats.totalRounds + rounds,
    best: Math.max(stats.best, rounds),
    bestByRegion: {
      ...stats.bestByRegion,
      [token]: Math.max(stats.bestByRegion[token] ?? 0, rounds),
    },
    bestScore: Math.max(stats.bestScore, run.score),
    bestScoreByRegion: {
      ...stats.bestScoreByRegion,
      [token]: Math.max(stats.bestScoreByRegion[token] ?? 0, run.score),
    },
    summited:
      run.summited && !stats.summited.includes(token)
        ? [...stats.summited, token]
        : stats.summited,
    active: null,
  };
};

// --- Sharing ---------------------------------------------------------------

/**
 * One square per round: banked it green, let off with a near miss yellow, and
 * red where a life went. The runner-up earning its own colour is the point —
 * a row with yellows in it reads as a closer run than one without.
 */
const ROUND_SQUARES: Record<RoundEnding, string> = {
  banked: "🟩",
  close: "🟨",
  bust: "🟥",
};

/**
 * The share card. One square per round keeps it to a few lines however long
 * the run was, and the link carries the seed, the settings and the result — so
 * whoever opens it plays the same expedition, against the same cards, with the
 * number to beat already on screen.
 */
export const shareText = (
  run: ExpeditionRun,
  regionLabel: string,
  origin?: string,
): string => {
  const squares = run.history.map((record) => ROUND_SQUARES[record.ending]).join("");

  const lines = [
    `Urban Compass · Expedition — ${regionLabel}`,
    `Round ${roundsReached(run)} · ${run.score} pts${run.summited ? " · summit 🏔" : ""}`,
    squares,
  ];
  if (origin) {
    lines.push(
      runUrl(origin, run.seed, run.config, {
        round: roundsReached(run),
        score: run.score,
        rounds: run.history.map((record) => record.ending),
      }),
    );
  }
  return lines.join("\n");
};
