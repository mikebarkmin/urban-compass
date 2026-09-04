import { useState, useEffect } from "react";
import { useGameRoom } from "@/hooks/useGameRoom";
import { stringToColor } from "@/utils";
import {
  City,
  Category,
  categoryDisplayNames,
  ALL_CATEGORIES,
  SCORING_VALUES,
} from "../../game/cities";
import { GameState, GamePhase, User, Guess, Queues } from "../../game/logic";

interface GameProps {
  username: string;
  roomId: string;
}

// Helper to get queue count for a city and category
const getQueueCount = (queues: Queues, category: Category, cityId: string): number => {
  const catQueue = queues.get(category);
  if (!catQueue) return 0;
  const cityGuesses = catQueue.get(cityId);
  return cityGuesses ? cityGuesses.length : 0;
};

// Helper to check if current user has placed a guess for a category
const hasUserPlacedGuess = (user: User | undefined, category: Category): boolean => {
  if (!user) return false;
  return user.placedGuesses.some(g => g.category === category);
};

// Helper to get user's guess for a category
const getUserGuessForCategory = (user: User | undefined, category: Category): string | null => {
  if (!user) return null;
  const guess = user.placedGuesses.find(g => g.category === category);
  return guess ? guess.cityId : null;
};

// Helper to get city by ID
const getCityById = (cities: City[], cityId: string): City | undefined => {
  return cities.find(c => c.id === cityId);
};

const Game = ({ username, roomId }: GameProps) => {
  const { gameState, dispatch } = useGameRoom(username, roomId);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Get current user
  const currentUser = gameState?.users.find(u => u.id === username);

  // Indicated that the game is loading
  if (gameState === null) {
    return (
      <p>
        <span className="transition-all w-fit inline-block mr-4 animate-bounce">
          🎲
        </span>
        Waiting for server...
      </p>
    );
  }

  // Handle placing a guess
  const handlePlaceGuess = (category: Category, cityId: string) => {
    dispatch({ type: "place_guess", category, cityId });
    setSelectedCategory(null);
    setSelectedCity(null);
  };

  // Handle starting the game
  const handleStartGame = () => {
    dispatch({ type: "start_game" });
  };

  // Handle revealing answers
  const handleRevealAnswers = () => {
    dispatch({ type: "reveal_answers" });
  };

  // Handle next round
  const handleNextRound = () => {
    dispatch({ type: "next_round" });
  };

  // Get user's available categories
  const availableCategories = currentUser 
    ? ALL_CATEGORIES.filter(cat => 
        !currentUser.placedGuesses.some(g => g.category === cat)
      )
    : [];

  // Check if all users have placed all guesses
  const allGuessesPlaced = gameState.phase === "playing" && 
    gameState.users.every(u => u.availableGuessCards.length === 0);

  // Render waiting state
  if (gameState.phase === "waiting") {
    return (
      <>
        <h1 className="text-2xl border-b border-yellow-400 text-center relative">
          🎯 Spot On - German Cities Game
        </h1>
        
        <div className="bg-yellow-100 p-4 rounded my-4">
          <h2 className="text-lg font-bold mb-2">⏳ Waiting for players...</h2>
          <p className="text-sm">Need at least 2 players to start the game.</p>
          <p className="text-xs mt-2">Share this room ID with friends: <span className="font-bold">{roomId}</span></p>
        </div>

        {gameState.users.length >= 2 && (
          <button
            onClick={handleStartGame}
            className="rounded border p-4 bg-green-500 text-white font-bold shadow hover:bg-green-600 transition-colors"
          >
            Start Game
          </button>
        )}

        <div className="border-t border-yellow-400 py-2 my-4" />

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg">Players in room <span className="font-bold">{roomId}</span></h2>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
          >
            {showInstructions ? "Hide" : "Show"} Instructions
          </button>
        </div>

        {showInstructions && (
          <div className="bg-blue-50 p-3 rounded mb-4 text-sm">
            <h3 className="font-bold mb-2">How to Play Spot On:</h3>
            <p className="mb-2">Predict which city satisfies different criteria (northernmost, most population, etc.).</p>
            <p className="mb-2">Place your guess cards into city queues. Earlier correct guesses score more points!</p>
            <p className="mb-1"><strong>Scoring:</strong> 1st: 10pts, 2nd: 7pts, 3rd: 5pts, 4th: 3pts, 5th: 2pts, 6th: 1pt</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {gameState.users.map((user) => {
            return (
              <p
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-white"
                style={{ backgroundColor: stringToColor(user.id + roomId) }}
                key={user.id}
              >
                {user.id} (Score: {user.score})
              </p>
            );
          })}
        </div>
      </>
    );
  }

  // Render round over state
  if (gameState.phase === "round_over") {
    return (
      <>
        <h1 className="text-2xl border-b border-yellow-400 text-center relative">
          🎯 Spot On - Round {gameState.roundNumber} Complete
        </h1>

        <div className="bg-green-100 p-4 rounded my-4">
          <h2 className="text-lg font-bold mb-2">🏆 Round Results</h2>
          
          {gameState.correctAnswers && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {gameState.categories.map((category) => {
                const correctCity = gameState.correctAnswers![category];
                const queueCount = getQueueCount(gameState.queues, category, correctCity.id);
                
                return (
                  <div key={category} className="bg-white p-2 rounded shadow">
                    <div className="font-semibold text-sm">{categoryDisplayNames[category]}</div>
                    <div className="text-green-600 font-bold">{correctCity.name}</div>
                    <div className="text-xs text-gray-600">
                      {queueCount} guesses in queue
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="font-bold mb-2">Player Scores:</h3>
          <div className="space-y-1">
            {[...gameState.users].sort((a, b) => b.score - a.score).map((user) => (
              <div
                key={user.id}
                className="flex justify-between items-center p-2 bg-white rounded"
              >
                <span 
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: stringToColor(user.id + roomId) }}
                >
                  {user.id}
                </span>
                <span className="font-bold text-green-600">{user.score} points</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleNextRound}
          className="rounded border p-4 bg-blue-500 text-white font-bold shadow hover:bg-blue-600 transition-colors w-full"
        >
          Next Round →
        </button>

        <div className="border-t border-yellow-400 py-2 my-4" />

        <div className="bg-yellow-100 flex flex-col p-4 rounded text-sm">
          {gameState.log.map((logEntry, i) => (
            <p key={logEntry.dt} className="animate-appear text-black">
              {logEntry.message}
            </p>
          ))}
        </div>
      </>
    );
  }

  // Render playing state
  return (
    <>
      <h1 className="text-2xl border-b border-yellow-400 text-center relative">
        🎯 Spot On - Round {gameState.roundNumber}
      </h1>

      <div className="bg-blue-100 p-2 rounded my-2 text-center text-sm">
        <span className="font-bold">Time remaining:</span> 
        {gameState.roundStartTime && (
          <span className="font-mono">
            {Math.max(0, Math.floor((Date.now() - gameState.roundStartTime) / 1000))}s
          </span>
        )}
      </div>

      {/* Categories Section */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Categories</h2>
        <div className="flex flex-wrap gap-1 mb-2">
          {gameState.categories.map((category) => {
            const hasPlaced = hasUserPlacedGuess(currentUser, category);
            const userGuessCityId = getUserGuessForCategory(currentUser, category);
            const userGuessCity = userGuessCityId ? getCityById(gameState.cities, userGuessCityId) : null;
            
            return (
              <button
                key={category}
                onClick={() => {
                  if (!hasPlaced) {
                    setSelectedCategory(selectedCategory === category ? null : category);
                    setSelectedCity(null);
                  }
                }}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  hasPlaced
                    ? "bg-green-500 text-white cursor-not-allowed"
                    : selectedCategory === category
                      ? "bg-yellow-400 text-black"
                      : "bg-gray-200 text-black hover:bg-yellow-300"
                }`}
                disabled={hasPlaced}
                title={hasPlaced ? `You placed: ${userGuessCity?.name || userGuessCityId}` : categoryDisplayNames[category]}
              >
                {categoryDisplayNames[category]}
                {hasPlaced && <span className="ml-1">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cities Section */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Cities</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {gameState.cities.map((city) => {
            const isSelected = selectedCity === city.id;
            const hasGuess = currentUser?.placedGuesses.some(g => g.cityId === city.id);
            
            // Count total guesses for each category on this city
            const categoryCounts = gameState.categories.map(cat => 
              getQueueCount(gameState.queues, cat, city.id)
            );
            const totalGuesses = categoryCounts.reduce((a, b) => a + b, 0);
            
            return (
              <button
                key={city.id}
                onClick={() => {
                  if (selectedCategory && !hasGuess) {
                    setSelectedCity(isSelected ? null : city.id);
                  } else if (selectedCategory) {
                    handlePlaceGuess(selectedCategory, city.id);
                  }
                }}
                className={`p-2 rounded text-sm transition-all ${
                  isSelected 
                    ? "bg-yellow-400 text-black ring-2 ring-yellow-600"
                    : hasGuess
                      ? "bg-green-100 text-green-800"
                      : "bg-white text-black hover:bg-gray-100 border"
                }`}
                disabled={!selectedCategory}
              >
                <div className="font-semibold">{city.name}</div>
                <div className="text-xs text-gray-600">
                  Pop: {(city.population / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-500">
                  Guesses: {totalGuesses}
                </div>
                {hasGuess && <div className="text-xs text-green-600">✓ Your guess</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Place Guess Button */}
      {selectedCategory && selectedCity && (
        <div className="my-4">
          <button
            onClick={() => handlePlaceGuess(selectedCategory, selectedCity)}
            className="rounded border p-4 bg-yellow-400 text-black font-bold shadow hover:bg-yellow-500 transition-colors w-full"
          >
            Place Guess: {categoryDisplayNames[selectedCategory]} → {getCityById(gameState.cities, selectedCity)?.name}
          </button>
        </div>
      )}

      {/* Queue Visualization */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Queues</h2>
        <div className="space-y-2">
          {gameState.categories.map((category) => {
            // Get all guesses for this category across all cities
            const catQueue = gameState.queues.get(category);
            if (!catQueue) return null;
            
            // Count guesses per city
            const cityCounts: { cityId: string; count: number; city: City }[] = [];
            catQueue.forEach((guesses, cityId) => {
              const city = getCityById(gameState.cities, cityId);
              if (city && guesses.length > 0) {
                cityCounts.push({ cityId, count: guesses.length, city });
              }
            });
            
            // Sort by count descending
            cityCounts.sort((a, b) => b.count - a.count);
            
            return (
              <div key={category} className="bg-gray-50 p-2 rounded">
                <div className="font-semibold text-sm mb-1">
                  {categoryDisplayNames[category]}
                </div>
                <div className="flex flex-wrap gap-1">
                  {cityCounts.map(({ cityId, count, city }) => (
                    <span
                      key={cityId}
                      className="bg-white px-2 py-1 rounded text-xs border"
                    >
                      {city.name}: {count}
                    </span>
                  ))}
                  {cityCounts.length === 0 && (
                    <span className="text-xs text-gray-500">No guesses yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 my-4">
        {allGuessesPlaced && (
          <button
            onClick={handleRevealAnswers}
            className="flex-1 rounded border p-3 bg-green-500 text-white font-bold shadow hover:bg-green-600 transition-colors"
          >
            Reveal Answers
          </button>
        )}
        
        <button
          onClick={handleRevealAnswers}
          disabled={!allGuessesPlaced}
          className="flex-1 rounded border p-3 bg-gray-400 text-white font-bold shadow transition-colors disabled:opacity-50"
        >
          Reveal Answers (All must guess)
        </button>
      </div>

      {/* Player Info */}
      <div className="border-t border-yellow-400 py-2 my-4" />

      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg">Players in room <span className="font-bold">{roomId}</span></h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {gameState.users.map((user) => {
          const guessesPlaced = user.placedGuesses.length;
          const totalCategories = gameState.categories.length;
          
          return (
            <div
              key={user.id}
              className="inline-flex flex-col items-center"
            >
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                style={{ backgroundColor: stringToColor(user.id + roomId) }}
              >
                {user.id} ({user.score})
              </span>
              <span className="text-xs text-gray-600">
                {guessesPlaced}/{totalCategories} guesses
              </span>
            </div>
          );
        })}
      </div>

      {/* Log */}
      <div className="border-t border-yellow-400 py-2 my-4" />

      <div className="bg-yellow-100 flex flex-col p-4 rounded text-sm">
        {gameState.log.map((logEntry, i) => (
          <p key={logEntry.dt} className="animate-appear text-black">
            {logEntry.message}
          </p>
        ))}
      </div>
    </>
  );
};

export default Game;
