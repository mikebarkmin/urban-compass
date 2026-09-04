import usePartySocket from "partysocket/react";
import { useState, useEffect } from "react";
import { GameState, Action, deserializeQueues } from "../../game/logic";
import { ALL_CATEGORIES } from "../../game/cities";

// Custom reviver function to handle Map deserialization
const reviver = (key: string, value: any) => {
  if (value && value.__type === "Map") {
    return new Map(value.data);
  }
  return value;
};

// Deserialize game state from received message
const deserializeGameState = (data: string, categories: typeof ALL_CATEGORIES, cities: any[]): GameState => {
  const parsed = JSON.parse(data, reviver);
  
  // Convert queues back to Map structure if it's an object
  if (parsed.queues && typeof parsed.queues === "object" && !(parsed.queues instanceof Map)) {
    parsed.queues = deserializeQueues(parsed.queues, categories, cities);
  }
  
  return parsed;
};

export const useGameRoom = (username: string, roomId: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_SERVER_URL || "127.0.0.1:1999",
    room: roomId,
    id: username,
    onMessage(event: MessageEvent<string>) {
      // Deserialize the game state
      const cities = gameState?.cities || [];
      const parsedState = deserializeGameState(event.data, ALL_CATEGORIES, cities);
      setGameState(parsedState);
    },
  });

  const dispatch = (action: Action) => {
    socket.send(JSON.stringify(action));
  };

  return {
    gameState,
    dispatch,
  };
};
