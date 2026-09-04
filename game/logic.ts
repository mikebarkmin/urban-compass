import {
  City,
  Category,
  ALL_CATEGORIES,
  SCORING_VALUES,
  getCorrectAnswers,
  selectRandomCities,
} from "./cities";

// util for easy adding logs
const addLog = (message: string, logs: GameState["log"]): GameState["log"] => {
  return [{ dt: new Date().getTime(), message: message }, ...logs].slice(
    0,
    MAX_LOG_SIZE,
  );
};

// If there is anything you want to track for a specific user, change this interface
export interface User {
  id: string;
  score: number;
  // Track which guess cards the user has available
  availableGuessCards: Category[];
  // Track which guesses the user has placed (for UI feedback)
  placedGuesses: PlacedGuess[];
}

// A placed guess in the queue
export interface Guess {
  userId: string;
  category: Category;
  cityId: string;
  timestamp: number;
}

// Information about a guess placed by the current user
export interface PlacedGuess {
  category: Category;
  cityId: string;
}

// Do not change this! Every game has a list of users and log of actions
interface BaseGameState {
  users: User[];
  log: {
    dt: number;
    message: string;
  }[];
}

// Do not change!
export type Action = DefaultAction | GameAction;

// Do not change!
export type ServerAction = WithUser<DefaultAction> | WithUser<GameAction>;

// The maximum log size, change as needed
const MAX_LOG_SIZE = 10;

// Game phases
export type GamePhase = "waiting" | "playing" | "resolving" | "round_over";

// Queue structure: category -> cityId -> array of guesses in order
export type Queues = Map<Category, Map<string, Guess[]>>;

type WithUser<T> = T & { user: User };

export type DefaultAction = { type: "UserEntered" } | { type: "UserExit" };

// This interface holds all the information about your game
export interface GameState extends BaseGameState {
  phase: GamePhase;
  cities: City[];
  categories: Category[];
  queues: Queues;
  roundNumber: number;
  correctAnswers: Record<Category, City> | null;
  // Track when the round started for timing
  roundStartTime: number | null;
  // Number of cities to use in each round
  citiesPerRound: number;
}

// This is how a fresh new game starts out, it's a function so you can make it dynamic!
export const initialGame = (): GameState => {
  const cities = selectRandomCities(8);
  const categories = [...ALL_CATEGORIES];
  
  return {
    users: [],
    phase: "waiting",
    cities: cities,
    categories: categories,
    queues: new Map(),
    roundNumber: 1,
    correctAnswers: null,
    roundStartTime: null,
    citiesPerRound: 8,
    log: addLog("Game Created! Waiting for players...", []),
  };
};

// Initialize queues for all categories and cities
const initializeQueues = (categories: Category[], cities: City[]): Queues => {
  const queues = new Map<Category, Map<string, Guess[]>>();
  
  for (const category of categories) {
    const cityQueue = new Map<string, Guess[]>();
    for (const city of cities) {
      cityQueue.set(city.id, []);
    }
    queues.set(category, cityQueue);
  }
  
  return queues;
};

// Get queues for a specific category, ensuring it exists
const getCategoryQueue = (queues: Queues, category: Category): Map<string, Guess[]> => {
  let catQueue = queues.get(category);
  if (!catQueue) {
    catQueue = new Map();
    queues.set(category, catQueue);
  }
  return catQueue;
};

// Get guesses for a specific city in a category
const getCityGuesses = (queues: Queues, category: Category, cityId: string): Guess[] => {
  const catQueue = getCategoryQueue(queues, category);
  let guesses = catQueue.get(cityId);
  if (!guesses) {
    guesses = [];
    catQueue.set(cityId, guesses);
  }
  return guesses;
};

// Here are all the actions we can dispatch for a user
type GameAction = 
  | { type: "start_game" }
  | { type: "place_guess"; category: Category; cityId: string }
  | { type: "next_round" }
  | { type: "reveal_answers" };

// Helper to create a new user
export const createUser = (id: string): User => ({
  id,
  score: 0,
  availableGuessCards: [...ALL_CATEGORIES],
  placedGuesses: [],
});

// Calculate scores for all users based on queues and correct answers
export const calculateScores = (
  users: User[],
  queues: Queues,
  correctAnswers: Record<Category, City>,
  categories: Category[]
): User[] => {
  const newUsers = users.map(user => {
    let newScore = user.score;
    
    // For each category, check if the user has a guess in the correct city's queue
    for (const category of categories) {
      const correctCity = correctAnswers[category];
      if (!correctCity) continue;
      
      const cityGuesses = getCityGuesses(queues, category, correctCity.id);
      
      // Find all guesses by this user for this category in the correct city
      const userGuessesForCorrectCity = cityGuesses.filter(
        g => g.userId === user.id && g.category === category
      );
      
      if (userGuessesForCorrectCity.length > 0) {
        // Find the position of this user's FIRST guess in the queue
        // We need to look at ALL guesses in the correct city's queue for this category
        const allGuessesInOrder = [...cityGuesses];
        
        // Find the index of this user's first guess in the queue
        let userPosition = -1;
        for (let i = 0; i < allGuessesInOrder.length; i++) {
          if (allGuessesInOrder[i].userId === user.id) {
            userPosition = i + 1; // 1-based position
            break;
          }
        }
        
        if (userPosition > 0) {
          // Award points based on position
          const points = SCORING_VALUES[userPosition] || 0;
          newScore += points;
        }
      }
    }
    
    return {
      ...user,
      score: newScore,
    };
  });
  
  return newUsers;
};

// Reset guess cards for all users for a new round
const resetUserGuessCards = (usersList: User[], categories: Category[]): User[] => {
  return usersList.map(user => ({
    ...user,
    availableGuessCards: [...categories],
    placedGuesses: [],
  }));
};

export const gameUpdater = (
  action: ServerAction,
  state: GameState,
): GameState => {
  // This switch should have a case for every action type you add.

  // "UserEntered" & "UserExit" are defined by default

  // Every action has a user field that represent the user who dispatched the action,
  // you don't need to add this yourself
  switch (action.type) {
    case "UserEntered":
      // Don't add duplicate users
      if (state.users.some(u => u.id === action.user.id)) {
        return state;
      }
      
      const newUser = createUser(action.user.id);
      
      // If we have enough players (2+), we can start the game
      const allUsers = [...state.users, newUser];
      const nextPhase = allUsers.length >= 2 ? "playing" : "waiting";
      
      // Initialize queues if starting
      const userEnterQueues = nextPhase === "playing" && state.queues.size === 0 
        ? initializeQueues(state.categories, state.cities)
        : new Map(state.queues);

      return {
        ...state,
        users: allUsers,
        queues: userEnterQueues,
        phase: nextPhase,
        roundStartTime: nextPhase === "playing" ? Date.now() : state.roundStartTime,
        log: addLog(`user ${action.user.id} joined 🎉`, state.log),
      };

    case "UserExit":
      return {
        ...state,
        users: state.users.filter((user) => user.id !== action.user.id),
        log: addLog(`user ${action.user.id} left 😢`, state.log),
      };

    case "start_game":
      // Only allow the first user to start (or any user if already started)
      if (state.users.length < 2) {
        return {
          ...state,
          log: addLog("Need at least 2 players to start the game!", state.log),
        };
      }
      
      const startCities = selectRandomCities(state.citiesPerRound);
      const startQueues = initializeQueues(state.categories, startCities);
      const startUsers = resetUserGuessCards(state.users, state.categories);
      
      return {
        ...state,
        users: startUsers,
        cities: startCities,
        queues: startQueues,
        phase: "playing",
        roundNumber: state.roundNumber + 1,
        correctAnswers: null,
        roundStartTime: Date.now(),
        log: addLog(`Game started! Round ${state.roundNumber + 1} begins!`, state.log),
      };

    case "place_guess":
      // Check if game is in playing phase
      if (state.phase !== "playing") {
        return {
          ...state,
          log: addLog(`Cannot place guess: game is in ${state.phase} phase`, state.log),
        };
      }
      
      // Find the user
      const currentUser = state.users.find(u => u.id === action.user.id);
      if (!currentUser) {
        return state;
      }
      
      // Check if user already placed a guess for this category
      const alreadyPlaced = currentUser.placedGuesses.some(
        g => g.category === action.category
      );
      
      if (alreadyPlaced) {
        return {
          ...state,
          log: addLog(`User ${action.user.id} already placed a guess for ${action.category}`, state.log),
        };
      }
      
      // Check if city exists
      const selectedCity = state.cities.find(c => c.id === action.cityId);
      if (!selectedCity) {
        return {
          ...state,
          log: addLog(`Invalid city: ${action.cityId}`, state.log),
        };
      }
      
      // Add the guess to the queue
      const newQueuesMap = new Map(state.queues);
      const catQueue = getCategoryQueue(newQueuesMap, action.category);
      const cityGuesses = getCityGuesses(newQueuesMap, action.category, action.cityId);
      
      const newGuess: Guess = {
        userId: action.user.id,
        category: action.category,
        cityId: action.cityId,
        timestamp: Date.now(),
      };
      
      cityGuesses.push(newGuess);
      catQueue.set(action.cityId, [...cityGuesses]);
      newQueuesMap.set(action.category, catQueue);
      
      // Update user's placed guesses
      const updatedUsers = state.users.map(u => {
        if (u.id === action.user.id) {
          return {
            ...u,
            availableGuessCards: u.availableGuessCards.filter(c => c !== action.category),
            placedGuesses: [...u.placedGuesses, {
              category: action.category,
              cityId: action.cityId,
            }],
          };
        }
        return u;
      });
      
      // Check if all users have placed all their guesses
      const allGuessesPlaced = updatedUsers.every(u => u.availableGuessCards.length === 0);
      
      // If all guesses are placed, automatically reveal answers
      if (allGuessesPlaced) {
        const correctAnswers = getCorrectAnswers(state.cities);
        const scoredUsers = calculateScores(updatedUsers, newQueuesMap, correctAnswers, state.categories);
        
        return {
          ...state,
          users: scoredUsers,
          queues: newQueuesMap,
          correctAnswers: correctAnswers,
          phase: "round_over",
          log: addLog(
            `All guesses placed! Answers revealed for round ${state.roundNumber}`,
            state.log
          ),
        };
      }
      
      return {
        ...state,
        users: updatedUsers,
        queues: newQueuesMap,
        log: addLog(
          `User ${action.user.id} placed guess for ${action.category} on ${selectedCity.name}`,
          state.log
        ),
      };

    case "reveal_answers":
      // Only allow revealing in playing phase
      if (state.phase !== "playing") {
        return state;
      }
      
      const correctAnswers = getCorrectAnswers(state.cities);
      const scoredUsers = calculateScores(state.users, state.queues, correctAnswers, state.categories);
      
      return {
        ...state,
        users: scoredUsers,
        correctAnswers: correctAnswers,
        phase: "round_over",
        roundStartTime: null,
        log: addLog(
          `Answers revealed! Round ${state.roundNumber} complete.`,
          state.log
        ),
      };

    case "next_round":
      if (state.phase !== "round_over") {
        return state;
      }
      
      const nextCities = selectRandomCities(state.citiesPerRound);
      const nextQueues = initializeQueues(state.categories, nextCities);
      const nextUsers = resetUserGuessCards(state.users, state.categories);
      
      return {
        ...state,
        users: nextUsers,
        cities: nextCities,
        queues: nextQueues,
        phase: "playing",
        roundNumber: state.roundNumber + 1,
        correctAnswers: null,
        roundStartTime: Date.now(),
        log: addLog(
          `Starting round ${state.roundNumber + 1}!`,
          state.log
        ),
      };
  }
  
  return state;
};

// Helper to serialize Map for JSON
export const serializeQueues = (queues: Queues): any => {
  const result: any = {};
  queues.forEach((cityMap, category) => {
    result[category] = {};
    cityMap.forEach((guesses, cityId) => {
      result[category][cityId] = guesses;
    });
  });
  return result;
};

// Helper to deserialize Map from JSON
export const deserializeQueues = (data: any, categories: Category[], cities: City[]): Queues => {
  const queues = new Map<Category, Map<string, Guess[]>>();
  
  for (const category of categories) {
    const cityQueue = new Map<string, Guess[]>();
    for (const city of cities) {
      cityQueue.set(city.id, data?.[category]?.[city.id] || []);
    }
    queues.set(category, cityQueue);
  }
  
  return queues;
};
