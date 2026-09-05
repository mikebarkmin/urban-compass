import {
  City,
  PublicCity,
  Category,
  ALL_CATEGORIES,
  CORE_CATEGORIES,
  MIN_CATEGORIES,
  supportedCategories,
  BoardQuality,
  SCORING_VALUES,
  drawBoard,
  getCorrectAnswers,
} from "./cities";
import {
  CITY_SETS,
  CUSTOM_CITY_SET_ID,
  DEFAULT_CITY_SET_ID,
  MIN_POOL_SIZE,
  getCitySet,
  sanitizeCityPool,
} from "./citySets";

// The maximum log size, change as needed
const MAX_LOG_SIZE = 12;

// Two entries can land in the same millisecond, so timestamps alone do not
// identify a line. This counter keeps the React keys on the client unique.
let logSequence = 0;

/**
 * Log lines are stored as a key plus its values, never as finished English.
 * The room broadcasts the same state to everybody, so the sentence has to be
 * built on each client in whatever language that player is reading.
 */
export interface LogEntry {
  id: string;
  dt: number;
  key: string;
  params?: Record<string, string | number>;
}

const addLog = (
  key: string,
  logs: LogEntry[],
  params?: Record<string, string | number>,
): LogEntry[] => {
  const dt = new Date().getTime();
  return [{ id: `${dt}-${logSequence++}`, dt, key, ...(params ? { params } : {}) }, ...logs].slice(
    0,
    MAX_LOG_SIZE,
  );
};

// If there is anything you want to track for a specific user, change this interface
export interface User {
  id: string;
  score: number;
  /** Categories this user has not placed yet in the current round. */
  availableGuessCards: Category[];
  /** Guesses this user has placed in the current round, at most `cardsPerPlayer`. */
  placedGuesses: PlacedGuess[];
  /** True while it is this user's turn. */
  isActive: boolean;
  /** False for players who joined after the current round started. */
  inRound: boolean;
  /** Turns this user has let run out in the current round. */
  timeouts: number;
  /**
   * Cards this user lost in the current round without placing them — a failed
   * steal, or a bet that somebody else stole. They still count against the hand
   * so that losing a card is a real cost.
   */
  burned: number;
  /** Whether the player still holds their 2× card. */
  doubleDownAvailable: boolean;
}

/**
 * A guess as it appears in a city queue. It deliberately carries no category:
 * everyone can see *that* you bet on a city, not *what* you bet on it for.
 */
export interface Guess {
  userId: string;
  cityId: string;
  timestamp: number;
  /**
   * Played with the player's 2× card. Deliberately public: it still does not
   * say *which* card was played, only that somebody is sure about it, which is
   * exactly the kind of tell the table should get to read.
   */
  doubled?: boolean;
}

export interface PlacedGuess {
  category: Category;
  cityId: string;
  doubled?: boolean;
}

// Do not change this! Every game has a list of users and log of actions
interface BaseGameState {
  users: User[];
  log: LogEntry[];
}

// Do not change!
export type Action = DefaultAction | GameAction;

// Do not change!
export type ServerAction = WithUser<DefaultAction> | WithUser<GameAction>;

type WithUser<T> = T & { user: User };

export type DefaultAction = { type: "UserEntered" } | { type: "UserExit" };

// Game phases
export type GamePhase = "lobby" | "playing" | "round_over" | "game_over";

/** cityId -> guesses placed on it, in the order they were placed. */
export type Queues = Record<string, Guess[]>;

/** userId -> category -> the guess that user placed for it. */
export type CategoryGuesses = Record<string, Partial<Record<Category, Guess>>>;

/**
 * Everything the host can dial in from the lobby. Kept in one object so the
 * client can send a partial update and the server can clamp the whole thing in
 * one place.
 */
export interface GameSettings {
  /** How many cities are dealt onto the board each round. */
  citiesPerRound: number;
  /** How many of their six cards each player places in a round. */
  cardsPerPlayer: number;
  /**
   * How many times every player must have started a round before the game
   * ends. One cycle means one round per player.
   */
  cycles: number;
  /** Seconds a player has to place a card, or 0 to play without a clock. */
  turnSeconds: number;
  /** Whether round boards are rejection-sampled for a good spread of answers. */
  boardQuality: BoardQuality;

  // --- Optional mechanics. Every one of these is off in a default room; the
  // base game never depends on them.

  /**
   * Two players betting the same card on the same city cancel each other out.
   * Turns the visible chips into real pressure: a crowded city is a reason to
   * look elsewhere rather than to pile on.
   */
  collisionPenalty: boolean;
  /** Points docked for each card that missed, or 0 to play with no downside. */
  wrongGuessPenalty: number;
  /** How often a player gets a 2× card. */
  doubleDown: DoubleDownMode;
  /**
   * Whether a turn may be spent naming what an opponent bet. Guess right and
   * you take their bet and its place in the queue; guess wrong and the card is
   * gone.
   */
  steals: boolean;
}

/** When a player gets their one 2× card: never, once a game, or once a round. */
export type DoubleDownMode = "off" | "game" | "round";

export const SETTING_BOUNDS = {
  citiesPerRound: { min: 6, max: 12 },
  cardsPerPlayer: { min: 1, max: ALL_CATEGORIES.length },
  cycles: { min: 1, max: 5 },
  turnSeconds: { min: 15, max: 180 },
  wrongGuessPenalty: { min: 0, max: 3 },
} as const;

/** Presets offered next to the turn-clock slider. */
export const TURN_CLOCK_CHOICES = [0, 20, 30, 45, 60, 90] as const;

/** Presets for the miss penalty. */
export const WRONG_GUESS_CHOICES = [0, 1, 2, 3] as const;

export const DOUBLE_DOWN_MODES: DoubleDownMode[] = ["off", "game", "round"];

/** What a 2× card multiplies a win — and a miss — by. */
export const DOUBLE_DOWN_FACTOR = 2;

export const DEFAULT_SETTINGS: GameSettings = {
  citiesPerRound: 8,
  cardsPerPlayer: 3,
  cycles: 1,
  turnSeconds: 0,
  boardQuality: "balanced",
  collisionPenalty: false,
  wrongGuessPenalty: 0,
  doubleDown: "off",
  steals: false,
};

/** How many timed-out turns a player gets before they sit out the round. */
export const MAX_TIMEOUTS_PER_ROUND = 2;

export const MIN_PLAYERS = 2;

// Kept for the places that just want the default hand size.
export const CARDS_PER_PLAYER = DEFAULT_SETTINGS.cardsPerPlayer;
export const MIN_CITIES_PER_ROUND = SETTING_BOUNDS.citiesPerRound.min;
export const MAX_CITIES_PER_ROUND = SETTING_BOUNDS.citiesPerRound.max;

// This interface holds all the information about your game
export interface GameState extends BaseGameState {
  phase: GamePhase;
  /** The room's host: the only player who can configure and start rounds. */
  hostId: string | null;
  /** Identifier of the selected city set, or "custom" for an uploaded pool. */
  citySetId: string;
  citySetName: string;
  /** Every city a round can be drawn from. */
  cityPool: City[];
  /** The cities in play this round. */
  cities: City[];
  categories: Category[];
  settings: GameSettings;
  queues: Queues;
  categoryGuesses: CategoryGuesses;
  /** Rounds played so far in the current game. */
  roundNumber: number;
  correctAnswers: Partial<Record<Category, City>> | null;
  roundStartTime: number | null;
  /** When the current player's clock runs out, or null when there is no clock. */
  turnEndsAt: number | null;
  currentTurnUserId: string | null;
  /** userId -> how many rounds that player has started this game. */
  starterCounts: Record<string, number>;
  /** Who started the current round. */
  roundStarterId: string | null;
  /** Ids of players who are done placing guesses this round. */
  completedTurns: string[];
  /** Turn order, frozen when the round starts. */
  turnOrder: string[];
  /**
   * City ids that have already appeared on a board this game. A city is not
   * drawn again until every other city in the pool has been used, then the
   * list resets — like a shuffled playlist that only repeats once exhausted.
   */
  usedCityIds: string[];
}

/**
 * The shape clients actually receive: the city pool is replaced by a summary
 * and in-play cities are stripped of the values that would give the answers
 * away. See `toPublicState` in the server.
 */
export type ClientGameState = Omit<GameState, "cities" | "cityPool"> & {
  cities: PublicCity[];
  cityPool: never[];
  poolSize: number;
  /**
   * Which cards the current pool is able to offer at all. The client never sees
   * the pool itself, so it cannot work this out for itself.
   */
  availableCategories: Category[];
  /** True once coordinates and populations may be shown. */
  revealed: boolean;
  /**
   * The server's clock at the moment the frame was sent. Clients offset their
   * own clock against it so the turn countdown agrees with the room's timer
   * even when a player's machine is minutes out.
   */
  serverNow: number;
};

// This is how a fresh new game starts out
export const initialGame = (): GameState => {
  const defaultSet = getCitySet(DEFAULT_CITY_SET_ID) ?? CITY_SETS[0];

  return {
    users: [],
    phase: "lobby",
    hostId: null,
    citySetId: defaultSet.id,
    citySetName: defaultSet.name,
    cityPool: defaultSet.cities,
    cities: [],
    categories: categoriesForPool(defaultSet.cities, [...CORE_CATEGORIES]),
    settings: { ...DEFAULT_SETTINGS },
    queues: {},
    categoryGuesses: {},
    roundNumber: 0,
    correctAnswers: null,
    roundStartTime: null,
    turnEndsAt: null,
    currentTurnUserId: null,
    starterCounts: {},
    roundStarterId: null,
    completedTurns: [],
    turnOrder: [],
    usedCityIds: [],
    log: addLog("log.roomCreated", []),
  };
};

// Here are all the actions we can dispatch for a user
type GameAction =
  | { type: "start_game" }
  | { type: "place_guess"; category: Category; cityId: string; doubled?: boolean }
  | { type: "steal"; targetUserId: string; cityId: string; category: Category }
  | { type: "next_round" }
  | { type: "end_turn" }
  | { type: "back_to_lobby" }
  | { type: "select_city_set"; setId: string }
  | { type: "upload_city_set"; name: string; cities: unknown }
  | { type: "update_settings"; settings: Partial<GameSettings> }
  | { type: "set_categories"; categories: Category[] }
  | { type: "turn_timeout" };

/**
 * Actions a client is allowed to send. `turn_timeout` is missing on purpose:
 * only the room's own clock may fire it, otherwise a player could skip past
 * whoever is holding them up.
 */
export const CLIENT_ACTION_TYPES: ReadonlySet<string> = new Set([
  "start_game",
  "place_guess",
  "steal",
  "next_round",
  "end_turn",
  "back_to_lobby",
  "select_city_set",
  "upload_city_set",
  "update_settings",
  "set_categories",
]);

// Helper to create a new user
export const createUser = (id: string): User => ({
  id,
  score: 0,
  availableGuessCards: [...CORE_CATEGORIES],
  placedGuesses: [],
  isActive: false,
  inRound: false,
  timeouts: 0,
  burned: 0,
  doubleDownAvailable: false,
});

/** Everybody who bet the winning city for a category, earliest placement first. */
export const winnersForCategory = (
  categoryGuesses: CategoryGuesses,
  category: Category,
  correctCityId: string,
): Guess[] =>
  Object.values(categoryGuesses)
    .map((guesses) => guesses[category])
    .filter((guess): guess is Guess => !!guess && guess.cityId === correctCityId)
    .sort((a, b) => a.timestamp - b.timestamp);

/**
 * What one category paid out, and why. The results screen renders straight from
 * this so the board and the scoreboard can never tell different stories.
 */
export interface ContenderResult {
  guess: Guess;
  doubled: boolean;
  /** What this bet was worth after doubling and any collision. */
  points: number;
}

export interface CategoryResult {
  category: Category;
  cityId: string;
  /** Everyone who bet the right city, earliest placement first. */
  contenders: ContenderResult[];
  /** True when two or more right answers cancelled each other out. */
  collided: boolean;
}

export interface PlayerTotals {
  /** Points won from categories. */
  earned: number;
  /** Points docked for cards that missed. */
  penalty: number;
  /** How many cards missed. */
  missed: number;
  total: number;
}

export interface RoundOutcome {
  categories: CategoryResult[];
  totals: Record<string, PlayerTotals>;
}

const emptyTotals = (): PlayerTotals => ({ earned: 0, penalty: 0, missed: 0, total: 0 });

/**
 * Score a finished round.
 *
 * The base game pays 3 · 2 · 1 to the first three players to get a category
 * right. The optional mechanics layer on top of that: a collision wipes a
 * category for everyone who tied on it, a 2× card doubles what a bet is worth
 * in both directions, and a miss penalty docks points for cards that landed on
 * the wrong city.
 */
export const scoreRound = (
  users: User[],
  categoryGuesses: CategoryGuesses,
  correctAnswers: Partial<Record<Category, City>>,
  categories: Category[],
  settings: GameSettings,
): RoundOutcome => {
  const totals: Record<string, PlayerTotals> = {};
  for (const user of users) totals[user.id] = emptyTotals();
  const totalsFor = (userId: string) => (totals[userId] ??= emptyTotals());

  const results: CategoryResult[] = [];

  for (const category of categories) {
    const correctCity = correctAnswers[category];
    if (!correctCity) continue;

    const winners = winnersForCategory(categoryGuesses, category, correctCity.id);
    // Being right is only worth something if you were right on your own.
    const collided = settings.collisionPenalty && winners.length > 1;

    const contenders = winners.map((guess, index) => {
      const doubled = !!guess.doubled;
      const base = collided ? 0 : (SCORING_VALUES[index + 1] ?? 0);
      const points = doubled ? base * DOUBLE_DOWN_FACTOR : base;
      totalsFor(guess.userId).earned += points;
      return { guess, doubled, points };
    });

    results.push({ category, cityId: correctCity.id, contenders, collided });
  }

  for (const [userId, guesses] of Object.entries(categoryGuesses)) {
    for (const category of categories) {
      const guess = guesses[category];
      if (!guess) continue;
      if (correctAnswers[category]?.id === guess.cityId) continue;

      const totalsForUser = totalsFor(userId);
      totalsForUser.missed += 1;
      // A 2× card cuts both ways, or it would be a free bet.
      totalsForUser.penalty +=
        settings.wrongGuessPenalty * (guess.doubled ? DOUBLE_DOWN_FACTOR : 1);
    }
  }

  for (const entry of Object.values(totals)) {
    entry.total = entry.earned - entry.penalty;
  }

  return { categories: results, totals };
};

/** Score a finished round and fold the points into every player's total. */
export const calculateScores = (users: User[], outcome: RoundOutcome): User[] =>
  users.map((user) => ({
    ...user,
    score: user.score + (outcome.totals[user.id]?.total ?? 0),
  }));

/** The hand size actually in play, never more cards than there are categories. */
export const handSizeFor = (state: Pick<GameState, "settings" | "categories">): number =>
  Math.min(state.settings.cardsPerPlayer, state.categories.length);

/**
 * How many rounds are still owed before every player has started `cycles`
 * times. Drives the "Round 2 of 5" counter, and grows when somebody joins
 * mid-game so that the newcomer still gets a round of their own to open.
 */
export const roundsRemaining = (
  users: User[],
  starterCounts: Record<string, number>,
  cycles: number,
): number =>
  users.reduce((total, user) => total + Math.max(0, cycles - (starterCounts[user.id] ?? 0)), 0);

/** True once every player present has opened their share of rounds. */
const gameIsOver = (state: GameState, users: User[]): boolean =>
  users.length > 0 && roundsRemaining(users, state.starterCounts, state.settings.cycles) === 0;

const initializeQueues = (cities: City[]): Queues => {
  const queues: Queues = {};
  for (const city of cities) {
    queues[city.id] = [];
  }
  return queues;
};

const initializeCategoryGuesses = (users: User[]): CategoryGuesses => {
  const categoryGuesses: CategoryGuesses = {};
  for (const user of users) {
    categoryGuesses[user.id] = {};
  }
  return categoryGuesses;
};

/** Reset every player's hand and mark them as taking part in the round. */
const resetUsersForRound = (
  users: User[],
  categories: Category[],
  settings: GameSettings,
): User[] =>
  users.map((user) => ({
    ...user,
    availableGuessCards: [...categories],
    placedGuesses: [],
    isActive: false,
    inRound: true,
    timeouts: 0,
    burned: 0,
    // A per-round 2× card comes back every deal; a per-game one does not.
    doubleDownAvailable:
      settings.doubleDown === "round" ? true : user.doubleDownAvailable,
  }));

const withActiveUser = (users: User[], activeUserId: string | null): User[] =>
  users.map((user) => ({ ...user, isActive: user.id === activeUserId }));

/**
 * A player is out of the round once their whole hand is gone — placed, or lost
 * to a failed steal or to somebody stealing their bet.
 */
export const handIsSpent = (user: User, handSize: number): boolean =>
  user.placedGuesses.length + user.burned >= handSize ||
  user.availableGuessCards.length === 0;

/** Cards this player still has to play with this round. */
export const cardsLeftFor = (user: User, handSize: number): number =>
  Math.max(0, handSize - user.placedGuesses.length - user.burned);

/**
 * The next player in `turnOrder` after `currentId` who is still connected and
 * still has cards to place, or null when the round is over.
 */
const nextTurnUserId = (
  turnOrder: string[],
  users: User[],
  completedTurns: string[],
  currentId: string | null,
  handSize: number,
): string | null => {
  if (turnOrder.length === 0) return null;
  const startIndex = currentId ? turnOrder.indexOf(currentId) : -1;

  for (let step = 1; step <= turnOrder.length; step++) {
    const candidateId = turnOrder[(startIndex + step + turnOrder.length) % turnOrder.length];
    if (completedTurns.includes(candidateId)) continue;
    const candidate = users.find((u) => u.id === candidateId);
    if (!candidate) continue;
    if (handIsSpent(candidate, handSize)) continue;
    return candidateId;
  }

  return null;
};

/** When the active player's clock expires, or null if the room plays untimed. */
const turnDeadline = (settings: GameSettings): number | null =>
  settings.turnSeconds > 0 ? Date.now() + settings.turnSeconds * 1000 : null;

/**
 * Whoever has opened the fewest rounds so far, picked at random between ties.
 * Over a full game this hands every player exactly `cycles` opening turns
 * without ever making the same person go first twice in a row by default.
 */
const pickStarter = (users: User[], starterCounts: Record<string, number>): string | null => {
  if (users.length === 0) return null;

  const fewest = Math.min(...users.map((user) => starterCounts[user.id] ?? 0));
  const candidates = users.filter((user) => (starterCounts[user.id] ?? 0) === fewest);
  return candidates[Math.floor(Math.random() * candidates.length)].id;
};

/** Close the round: reveal the answers, award points, and see if that was it. */
const finishRound = (state: GameState, users: User[], reasonKey: string): GameState => {
  const correctAnswers = getCorrectAnswers(state.cities, state.categories);
  const outcome = scoreRound(
    users,
    state.categoryGuesses,
    correctAnswers,
    state.categories,
    state.settings,
  );
  const scored = calculateScores(users, outcome);
  const finished = gameIsOver(state, scored);

  let log = addLog(reasonKey, state.log);
  if (finished) {
    const champion = [...scored].sort((a, b) => b.score - a.score)[0];
    log = champion
      ? addLog("log.gameWon", log, { player: champion.id, score: champion.score })
      : addLog("log.gameOver", log);
  }

  return {
    ...state,
    users: withActiveUser(scored, null),
    correctAnswers,
    phase: finished ? "game_over" : "round_over",
    currentTurnUserId: null,
    turnEndsAt: null,
    log,
  };
};

/** Deal a fresh round from the current pool, opened by a new starting player. */
const startRound = (state: GameState, roundNumber: number): GameState => {
  // Exclude cities that have already appeared this game. When too few remain
  // for a full board, the list resets so the pool cycles without immediate
  // repeats — like a shuffled playlist that only re-shuffles once played through.
  const used = new Set(state.usedCityIds);
  let drawPool = used.size > 0 ? state.cityPool.filter((c) => !used.has(c.id)) : state.cityPool;
  if (drawPool.length < state.settings.citiesPerRound) {
    drawPool = state.cityPool;
  }

  const cities = drawBoard(
    drawPool,
    state.settings.citiesPerRound,
    state.settings.boardQuality,
    Math.random,
    state.categories,
  );
  const usedCityIds =
    drawPool === state.cityPool
      ? cities.map((c) => c.id)
      : [...state.usedCityIds, ...cities.map((c) => c.id)];

  const users = resetUsersForRound(state.users, state.categories, state.settings);

  // Everybody plays every round; only the seat that opens it moves around.
  const starterId = pickStarter(users, state.starterCounts);
  const order = users.map((u) => u.id);
  const pivot = starterId ? Math.max(0, order.indexOf(starterId)) : 0;
  const turnOrder = [...order.slice(pivot), ...order.slice(0, pivot)];
  const firstUserId = turnOrder[0] ?? null;

  const starterCounts = starterId
    ? { ...state.starterCounts, [starterId]: (state.starterCounts[starterId] ?? 0) + 1 }
    : state.starterCounts;

  const state2: GameState = {
    ...state,
    users: withActiveUser(users, firstUserId),
    cities,
    queues: initializeQueues(cities),
    categoryGuesses: initializeCategoryGuesses(users),
    phase: "playing",
    roundNumber,
    correctAnswers: null,
    currentTurnUserId: firstUserId,
    starterCounts,
    roundStarterId: starterId,
    completedTurns: [],
    turnOrder,
    usedCityIds,
    roundStartTime: Date.now(),
    turnEndsAt: turnDeadline(state.settings),
  };

  const remaining = roundsRemaining(users, starterCounts, state.settings.cycles);

  return {
    ...state2,
    log: addLog("log.roundStarted", state.log, {
      round: roundNumber,
      total: roundNumber + remaining,
      player: firstUserId ?? "",
      count: cities.length,
      setId: state.citySetId,
      setName: state.citySetName,
    }),
  };
};

/** Wipe the scoreboard and the rotation for a brand new game. */
const startGame = (state: GameState): GameState =>
  startRound(
    {
      ...state,
      users: state.users.map((user) => ({
        ...user,
        score: 0,
        doubleDownAvailable: state.settings.doubleDown !== "off",
      })),
      starterCounts: {},
      usedCityIds: [],
      log: addLog("log.newGame", state.log, {
        cycles: state.settings.cycles,
        total: state.users.length * state.settings.cycles,
      }),
    },
    1,
  );

/**
 * The cards a room can play with after its pool changed. Whatever the host had
 * selected is kept where the new pool still supports it, and the core six fill
 * in otherwise — a set with no elevation must not leave the room holding
 * altitude cards nothing can answer.
 */
const categoriesForPool = (pool: City[], wanted: Category[]): Category[] => {
  const offered = supportedCategories(pool);
  const kept = wanted.filter((category) => offered.includes(category));
  if (kept.length >= MIN_CATEGORIES) return kept;

  const core = offered.filter((category) => CORE_CATEGORIES.includes(category));
  return core.length >= MIN_CATEGORIES ? core : offered;
};

const isHost = (state: GameState, userId: string) => state.hostId === userId;

const rejectWith = (
  state: GameState,
  key: string,
  params?: Record<string, string | number>,
): GameState => ({
  ...state,
  log: addLog(key, state.log, params),
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Fold a partial settings update in, clamping every field to its bounds. Values
 * that are missing or unusable leave the current setting alone, so a client
 * cannot widen the game by sending nonsense.
 */
const applySettings = (
  current: GameSettings,
  patch: Partial<GameSettings>,
  poolSize: number,
): GameSettings => {
  const next = { ...current };

  const integer = (value: unknown): number | null => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? parsed : null;
  };

  if (patch.citiesPerRound !== undefined) {
    const value = integer(patch.citiesPerRound);
    const max = Math.min(SETTING_BOUNDS.citiesPerRound.max, Math.max(poolSize, SETTING_BOUNDS.citiesPerRound.min));
    if (value !== null) next.citiesPerRound = clamp(value, SETTING_BOUNDS.citiesPerRound.min, max);
  }

  if (patch.cardsPerPlayer !== undefined) {
    const value = integer(patch.cardsPerPlayer);
    if (value !== null) {
      next.cardsPerPlayer = clamp(
        value,
        SETTING_BOUNDS.cardsPerPlayer.min,
        SETTING_BOUNDS.cardsPerPlayer.max,
      );
    }
  }

  if (patch.cycles !== undefined) {
    const value = integer(patch.cycles);
    if (value !== null) {
      next.cycles = clamp(value, SETTING_BOUNDS.cycles.min, SETTING_BOUNDS.cycles.max);
    }
  }

  if (patch.turnSeconds !== undefined) {
    const value = integer(patch.turnSeconds);
    if (value !== null) {
      next.turnSeconds =
        value <= 0
          ? 0
          : clamp(value, SETTING_BOUNDS.turnSeconds.min, SETTING_BOUNDS.turnSeconds.max);
    }
  }

  if (patch.boardQuality === "random" || patch.boardQuality === "balanced") {
    next.boardQuality = patch.boardQuality;
  }

  if (typeof patch.collisionPenalty === "boolean") {
    next.collisionPenalty = patch.collisionPenalty;
  }

  if (typeof patch.steals === "boolean") {
    next.steals = patch.steals;
  }

  if (patch.wrongGuessPenalty !== undefined) {
    const value = integer(patch.wrongGuessPenalty);
    if (value !== null) {
      next.wrongGuessPenalty = clamp(
        value,
        SETTING_BOUNDS.wrongGuessPenalty.min,
        SETTING_BOUNDS.wrongGuessPenalty.max,
      );
    }
  }

  if (patch.doubleDown !== undefined && DOUBLE_DOWN_MODES.includes(patch.doubleDown)) {
    next.doubleDown = patch.doubleDown;
  }

  return next;
};

export const gameUpdater = (action: ServerAction, state: GameState): GameState => {
  switch (action.type) {
    case "UserEntered": {
      if (state.users.some((u) => u.id === action.user.id)) {
        return state;
      }

      const joining = {
        ...createUser(action.user.id),
        doubleDownAvailable: state.settings.doubleDown !== "off",
      };
      const users = [...state.users, joining];
      const hostId = state.hostId ?? joining.id;

      // A newcomer has opened no rounds, so the game stretches to give them
      // their turn as starter rather than ending around them.
      const entered: GameState = {
        ...state,
        users,
        hostId,
        starterCounts: { ...state.starterCounts, [joining.id]: 0 },
        categoryGuesses: { ...state.categoryGuesses, [joining.id]: {} },
        log: addLog(hostId === joining.id ? "log.joinedHost" : "log.joined", state.log, {
          player: joining.id,
        }),
      };

      // Someone arriving after the last round means the game is not over yet.
      if (state.phase === "game_over") {
        return {
          ...entered,
          phase: "round_over",
          log: addLog("log.joinerExtends", entered.log, { player: joining.id }),
        };
      }

      return entered;
    }

    case "UserExit": {
      const users = state.users.filter((user) => user.id !== action.user.id);
      const hostId =
        state.hostId === action.user.id ? (users[0]?.id ?? null) : state.hostId;

      let leftState: GameState = {
        ...state,
        users,
        hostId,
        log: addLog("log.left", state.log, { player: action.user.id }),
      };

      if (hostId && hostId !== state.hostId) {
        leftState = rejectWith(leftState, "log.newHost", { player: hostId });
      }

      // The player who left may have been holding up the round.
      if (leftState.phase === "playing" && leftState.currentTurnUserId === action.user.id) {
        const nextId = nextTurnUserId(
          leftState.turnOrder,
          users,
          leftState.completedTurns,
          action.user.id,
          handSizeFor(leftState),
        );

        if (nextId === null) {
          return users.length > 0
            ? finishRound(leftState, users, "log.roundRevealed")
            : { ...leftState, phase: "lobby", currentTurnUserId: null, turnEndsAt: null };
        }

        return {
          ...leftState,
          users: withActiveUser(users, nextId),
          currentTurnUserId: nextId,
          turnEndsAt: turnDeadline(leftState.settings),
        };
      }

      // The last player still owing a round may have just walked out.
      if (leftState.phase === "round_over" && gameIsOver(leftState, users)) {
        return { ...leftState, phase: "game_over" };
      }

      return leftState;
    }

    case "select_city_set": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlyCitySet");
      }
      if (state.phase === "playing") {
        return rejectWith(state, "log.finishBeforeSwitch");
      }

      const set = getCitySet(action.setId);
      if (!set) {
        return rejectWith(state, "log.unknownCitySet", { setId: action.setId });
      }

      const categories = categoriesForPool(set.cities, state.categories);

      return {
        ...state,
        citySetId: set.id,
        citySetName: set.name,
        cityPool: set.cities,
        categories,
        usedCityIds: [],
        settings: applySettings(
          { ...state.settings, cardsPerPlayer: Math.min(state.settings.cardsPerPlayer, categories.length) },
          {},
          set.cities.length,
        ),
        log: addLog("log.citySetPicked", state.log, { set: set.id, count: set.cities.length }),
      };
    }

    case "upload_city_set": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlyUpload");
      }
      if (state.phase === "playing") {
        return rejectWith(state, "log.finishBeforeSwitch");
      }

      const cities = sanitizeCityPool(action.cities);
      if (cities.length < MIN_POOL_SIZE) {
        return rejectWith(
          state,
          `That file only yielded ${cities.length} usable cities (need at least ${MIN_POOL_SIZE}).`,
        );
      }

      const name = (typeof action.name === "string" ? action.name : "").trim().slice(0, 60);
      const citySetName = name || "Custom set";

      const uploadedCategories = categoriesForPool(cities, state.categories);

      return {
        ...state,
        citySetId: CUSTOM_CITY_SET_ID,
        citySetName,
        cityPool: cities,
        categories: uploadedCategories,
        usedCityIds: [],
        settings: applySettings(
          {
            ...state.settings,
            cardsPerPlayer: Math.min(state.settings.cardsPerPlayer, uploadedCategories.length),
          },
          {},
          cities.length,
        ),
        log: addLog("log.citySetUploaded", state.log, { name: citySetName, count: cities.length }),
      };
    }

    case "set_categories": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlySettings");
      }
      if (state.phase === "playing") {
        return rejectWith(state, "log.settingsLocked");
      }

      const offered = supportedCategories(state.cityPool);
      const wanted = Array.isArray(action.categories) ? action.categories : [];
      // Order is fixed by ALL_CATEGORIES so the hand always reads the same way,
      // whatever order the client happened to send.
      const chosen = ALL_CATEGORIES.filter(
        (category) => wanted.includes(category) && offered.includes(category),
      );

      if (chosen.length < MIN_CATEGORIES) {
        return rejectWith(state, "log.needCategories", { count: MIN_CATEGORIES });
      }

      return {
        ...state,
        categories: chosen,
        settings: {
          ...state.settings,
          cardsPerPlayer: Math.min(state.settings.cardsPerPlayer, chosen.length),
        },
      };
    }

    case "update_settings": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlySettings");
      }
      if (state.phase === "playing") {
        return rejectWith(state, "log.settingsLocked");
      }
      if (!action.settings || typeof action.settings !== "object") {
        return state;
      }

      return {
        ...state,
        settings: applySettings(state.settings, action.settings, state.cityPool.length),
      };
    }

    case "start_game": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlyStart");
      }
      if (state.phase === "playing") {
        return state;
      }
      if (state.users.length < MIN_PLAYERS) {
        return rejectWith(state, "log.needPlayers", { count: MIN_PLAYERS });
      }
      if (state.cityPool.length < MIN_POOL_SIZE) {
        return rejectWith(state, "log.poolTooSmall");
      }

      return startGame(state);
    }

    case "next_round": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlyNextRound");
      }
      if (state.phase !== "round_over") {
        return state;
      }
      if (state.users.length < MIN_PLAYERS) {
        return {
          ...state,
          phase: "lobby",
          log: addLog("log.backToLobbyShort", state.log),
        };
      }

      return startRound(state, state.roundNumber + 1);
    }

    case "back_to_lobby": {
      if (!isHost(state, action.user.id)) {
        return rejectWith(state, "log.hostOnlyLobby");
      }
      if (state.phase === "playing") {
        return rejectWith(state, "log.finishRoundFirst");
      }

      return {
        ...state,
        phase: "lobby",
        cities: [],
        queues: {},
        correctAnswers: null,
        currentTurnUserId: null,
        turnEndsAt: null,
        roundStarterId: null,
        completedTurns: [],
        turnOrder: [],
        usedCityIds: [],
        log: addLog("log.backToLobby", state.log),
      };
    }

    case "place_guess": {
      if (state.phase !== "playing") {
        return state;
      }
      if (state.currentTurnUserId !== action.user.id) {
        return rejectWith(state, "log.notYourTurn", { player: state.currentTurnUserId ?? "" });
      }
      if (!state.categories.includes(action.category)) {
        return state;
      }
      if (state.categoryGuesses[action.user.id]?.[action.category]) {
        return rejectWith(state, "log.cardAlreadyPlaced");
      }

      const city = state.cities.find((c) => c.id === action.cityId);
      if (!city) {
        return state;
      }

      const placer = state.users.find((u) => u.id === action.user.id);
      // A 2x card is only spent when the table plays with them and the player
      // still holds theirs; anything else is quietly treated as a plain bet.
      const doubled =
        !!action.doubled &&
        state.settings.doubleDown !== "off" &&
        !!placer?.doubleDownAvailable;

      const guess: Guess = {
        userId: action.user.id,
        cityId: action.cityId,
        timestamp: Date.now(),
        ...(doubled ? { doubled: true } : {}),
      };

      const queues: Queues = {
        ...state.queues,
        [action.cityId]: [...(state.queues[action.cityId] ?? []), guess],
      };

      const categoryGuesses: CategoryGuesses = {
        ...state.categoryGuesses,
        [action.user.id]: {
          ...state.categoryGuesses[action.user.id],
          [action.category]: guess,
        },
      };

      const users = state.users.map((user) =>
        user.id === action.user.id
          ? {
              ...user,
              availableGuessCards: user.availableGuessCards.filter((c) => c !== action.category),
              placedGuesses: [
                ...user.placedGuesses,
                { category: action.category, cityId: action.cityId, ...(doubled ? { doubled: true } : {}) },
              ],
              doubleDownAvailable: doubled ? false : user.doubleDownAvailable,
              // A placement clears the clock strikes against a player.
              timeouts: 0,
            }
          : user,
      );

      const placed: GameState = { ...state, users, queues, categoryGuesses };
      const spent = users.find((u) => u.id === action.user.id);

      // One card per turn: the seat always moves on after a placement. Players
      // who have just laid their last card drop out of the rotation for good.
      return passTurn(
        placed,
        action.user.id,
        spent && handIsSpent(spent, handSizeFor(placed)),
        doubled ? "log.betDoubled" : "log.bet",
        { player: action.user.id, city: city.name },
      );
    }

    case "steal": {
      if (state.phase !== "playing") {
        return state;
      }
      if (!state.settings.steals) {
        return rejectWith(state, "log.stealsOff");
      }
      if (state.currentTurnUserId !== action.user.id) {
        return rejectWith(state, "log.notYourTurn", { player: state.currentTurnUserId ?? "" });
      }
      if (action.targetUserId === action.user.id) {
        return rejectWith(state, "log.noSelfSteal");
      }
      if (!state.categories.includes(action.category)) {
        return state;
      }
      if (state.categoryGuesses[action.user.id]?.[action.category]) {
        return rejectWith(state, "log.alreadyHolding");
      }

      const city = state.cities.find((c) => c.id === action.cityId);
      const target = state.users.find((u) => u.id === action.targetUserId);
      if (!city || !target) {
        return state;
      }

      const theirGuess = state.categoryGuesses[action.targetUserId]?.[action.category];

      // A miss costs the card and says out loud what the city is *not*, which
      // is the information everybody else pays nothing for.
      if (!theirGuess || theirGuess.cityId !== action.cityId) {
        const users = state.users.map((user) =>
          user.id === action.user.id
            ? { ...user, burned: user.burned + 1, timeouts: 0 }
            : user,
        );
        const missed: GameState = { ...state, users };
        const thief = users.find((u) => u.id === action.user.id);

        return passTurn(
          missed,
          action.user.id,
          thief && handIsSpent(thief, handSizeFor(missed)),
          "log.stealMissed",
          {
            player: action.user.id,
            target: action.targetUserId,
            city: city.name,
            category: action.category,
          },
        );
      }

      // A hit takes the bet *and* its place in the queue, so the thief inherits
      // the payout the original bet would have earned. The 2x card does not
      // travel with it: that was the other player's gamble.
      const stolen: Guess = {
        userId: action.user.id,
        cityId: action.cityId,
        timestamp: theirGuess.timestamp,
      };

      const queue = state.queues[action.cityId] ?? [];
      const at = queue.findIndex(
        (g) => g.userId === action.targetUserId && g.timestamp === theirGuess.timestamp,
      );
      const queues: Queues = {
        ...state.queues,
        [action.cityId]:
          at >= 0 ? [...queue.slice(0, at), stolen, ...queue.slice(at + 1)] : [...queue, stolen],
      };

      const victimGuesses = { ...state.categoryGuesses[action.targetUserId] };
      delete victimGuesses[action.category];

      const categoryGuesses: CategoryGuesses = {
        ...state.categoryGuesses,
        [action.targetUserId]: victimGuesses,
        [action.user.id]: {
          ...state.categoryGuesses[action.user.id],
          [action.category]: stolen,
        },
      };

      const users = state.users.map((user) => {
        if (user.id === action.user.id) {
          return {
            ...user,
            availableGuessCards: user.availableGuessCards.filter((c) => c !== action.category),
            placedGuesses: [...user.placedGuesses, { category: action.category, cityId: action.cityId }],
            timeouts: 0,
          };
        }
        if (user.id === action.targetUserId) {
          // The card is gone rather than returned: burning it keeps the hand
          // accounting straight without handing the victim a free replacement.
          return {
            ...user,
            placedGuesses: user.placedGuesses.filter(
              (g) => !(g.category === action.category && g.cityId === action.cityId),
            ),
            burned: user.burned + 1,
          };
        }
        return user;
      });

      const robbed: GameState = { ...state, users, queues, categoryGuesses };
      const thief = users.find((u) => u.id === action.user.id);

      return passTurn(
        robbed,
        action.user.id,
        thief && handIsSpent(thief, handSizeFor(robbed)),
        "log.stealHit",
        {
          player: action.user.id,
          target: action.targetUserId,
          city: city.name,
          category: action.category,
        },
      );
    }

    case "end_turn": {
      if (state.phase !== "playing") {
        return state;
      }
      if (state.currentTurnUserId !== action.user.id) {
        return rejectWith(state, "log.notYourTurn", { player: state.currentTurnUserId ?? "" });
      }

      return passTurn(state, action.user.id, true, "log.satOut", { player: action.user.id });
    }

    case "turn_timeout": {
      if (state.phase !== "playing" || state.turnEndsAt === null) {
        return state;
      }
      if (state.currentTurnUserId !== action.user.id) {
        return state;
      }

      // One missed clock is a skipped turn; the next one takes the player out,
      // otherwise a player who never places would loop the round forever.
      const users = state.users.map((user) =>
        user.id === action.user.id ? { ...user, timeouts: user.timeouts + 1 } : user,
      );
      const timedOut = users.find((u) => u.id === action.user.id);
      const retire = (timedOut?.timeouts ?? 0) >= MAX_TIMEOUTS_PER_ROUND;

      return passTurn(
        { ...state, users },
        action.user.id,
        retire,
        retire ? "log.timedOutRetired" : "log.timedOut",
        { player: action.user.id },
      );
    }
  }
};

/**
 * Hand the turn to the next player, optionally retiring the current one from
 * the round first. Closes the round when nobody is left to play.
 */
const passTurn = (
  state: GameState,
  userId: string,
  retire: boolean | undefined,
  reasonKey: string,
  reasonParams: Record<string, string | number> = {},
): GameState => {
  const completedTurns =
    retire && !state.completedTurns.includes(userId)
      ? [...state.completedTurns, userId]
      : state.completedTurns;

  const nextId = nextTurnUserId(
    state.turnOrder,
    state.users,
    completedTurns,
    userId,
    handSizeFor(state),
  );

  if (nextId === null) {
    return finishRound({ ...state, completedTurns }, state.users, "log.roundRevealed");
  }

  return {
    ...state,
    users: withActiveUser(state.users, nextId),
    completedTurns,
    currentTurnUserId: nextId,
    turnEndsAt: turnDeadline(state.settings),
    log: addLog(reasonKey, state.log, { ...reasonParams, next: nextId }),
  };
};
