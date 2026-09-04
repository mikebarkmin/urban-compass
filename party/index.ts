import type * as Party from "partykit/server";

import { 
  gameUpdater, 
  initialGame, 
  Action, 
  ServerAction, 
  createUser,
  GameState,
  serializeQueues,
  deserializeQueues
} from "../game/logic";
import { ALL_CATEGORIES } from "../game/cities";

interface ServerMessage {
  state: GameState;
}

// Custom replacer function to handle Map serialization
const replacer = (key: string, value: any) => {
  if (value instanceof Map) {
    return {
      __type: "Map",
      data: Array.from(value.entries()),
    };
  }
  return value;
};

// Custom reviver function to handle Map deserialization
const reviver = (key: string, value: any) => {
  if (value && value.__type === "Map") {
    return new Map(value.data);
  }
  return value;
};

// Serialize game state for broadcasting
const serializeGameState = (state: GameState): string => {
  // Convert queues Map to a serializable format
  const queuesData = serializeQueues(state.queues);
  
  const serializableState = {
    ...state,
    queues: queuesData,
  };
  
  return JSON.stringify(serializableState, replacer);
};

// Deserialize game state from received message
const deserializeGameState = (data: string): GameState => {
  const parsed = JSON.parse(data, reviver);
  
  // Convert queues back to Map structure
  if (parsed.queues && typeof parsed.queues === "object") {
    parsed.queues = deserializeQueues(parsed.queues, ALL_CATEGORIES, parsed.cities || []);
  }
  
  return parsed;
};

export default class Server implements Party.Server {
  private gameState: GameState;

  constructor(readonly party: Party.Party) {
    this.gameState = initialGame();
    console.log("Room created:", party.id);
    console.log("Initial cities:", this.gameState.cities.map(c => c.name));
    // party.storage.put;
  }
  
  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!

    // let's send a message to the connection
    // conn.send();
    this.gameState = gameUpdater(
      { 
        type: "UserEntered", 
        user: createUser(connection.id)
      },
      this.gameState
    );
    console.log(`User ${connection.id} connected. Total users: ${this.gameState.users.length}`);
    this.party.broadcast(serializeGameState(this.gameState));
  }
  
  onClose(connection: Party.Connection) {
    this.gameState = gameUpdater(
      {
        type: "UserExit",
        user: createUser(connection.id),
      },
      this.gameState
    );
    console.log(`User ${connection.id} disconnected`);
    this.party.broadcast(serializeGameState(this.gameState));
  }
  
  onMessage(message: string, sender: Party.Connection) {
    const action: ServerAction = {
      ...(JSON.parse(message) as Action),
      user: createUser(sender.id),
    };
    console.log(`Received action ${action.type} from user ${sender.id}`);
    this.gameState = gameUpdater(action, this.gameState);
    this.party.broadcast(serializeGameState(this.gameState));
  }
}

Server satisfies Party.Worker;
