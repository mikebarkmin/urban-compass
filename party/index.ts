import type * as Party from "partykit/server";

import {
  gameUpdater,
  initialGame,
  createUser,
  CLIENT_ACTION_TYPES,
  GameState,
  ClientGameState,
  ServerAction,
} from "../game/logic";
import { City, PublicCity, supportedCategories } from "../game/cities";

/**
 * Project the server's state onto what a client is allowed to see.
 *
 * While a round is in progress the coordinates and populations of the cities in
 * play are withheld — otherwise "northernmost" and "most inhabitants" would be
 * readable straight out of the websocket frame. The full pool is never sent at
 * all; clients only need its size.
 */
const toPublicState = (state: GameState): ClientGameState => {
  const revealed = state.phase === "round_over" || state.phase === "game_over";

  const cities: PublicCity[] = state.cities.map((city: City) => ({
    id: city.id,
    name: city.name,
    nameDe: city.nameDe,
    country: city.country,
    latitude: revealed ? city.latitude : null,
    longitude: revealed ? city.longitude : null,
    population: revealed ? city.population : null,
    elevation: revealed ? (city.elevation ?? null) : null,
    area: revealed ? (city.area ?? null) : null,
  }));

  const { cityPool, parkedUsers, ...rest } = state;

  return {
    ...rest,
    cities,
    cityPool: [],
    poolSize: cityPool.length,
    availableCategories: supportedCategories(cityPool),
    revealed,
    serverNow: Date.now(),
  };
};

export default class Server implements Party.Server {
  private gameState: GameState;
  /** The pending turn-clock timer, if the room is playing with one. */
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Reconnect grace timers per user id. On disconnect the user is not removed
   * immediately; instead a timer is started. If the same user reconnects before
   * it fires (a page refresh, a brief network drop), the timer is cancelled and
   * the user's state is preserved. If it fires, the user is removed for real.
   */
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly RECONNECT_GRACE_MS = 10_000;

  constructor(readonly party: Party.Party) {
    this.gameState = initialGame();
  }

  private broadcast() {
    this.party.broadcast(JSON.stringify(toPublicState(this.gameState)));
  }

  /**
   * Keep the room's timer in step with the state. Clocks live on the server so
   * that a slow connection, a backgrounded tab or a closed laptop cannot stall
   * everybody else — and so a client cannot fake the expiry to skip a turn.
   */
  private syncTurnClock() {
    if (this.turnTimer !== null) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const { turnEndsAt, currentTurnUserId, phase } = this.gameState;
    if (phase !== "playing" || turnEndsAt === null || !currentTurnUserId) return;

    const deadline = turnEndsAt;
    const userId = currentTurnUserId;

    this.turnTimer = setTimeout(
      () => {
        this.turnTimer = null;
        // The turn may have moved on between the timer firing and running.
        if (
          this.gameState.currentTurnUserId !== userId ||
          this.gameState.turnEndsAt !== deadline
        ) {
          return;
        }

        this.apply({ type: "turn_timeout", user: createUser(userId) });
      },
      Math.max(0, deadline - Date.now()),
    );
  }

  private apply(action: ServerAction) {
    this.gameState = gameUpdater(action, this.gameState);
    this.syncTurnClock();
    this.broadcast();
  }

  onConnect(connection: Party.Connection) {
    // If a reconnect timer was ticking for this user, cancel it — they are back
    // and their state (score, guesses, turn) was preserved through the grace
    // period. The UserEntered below becomes a no-op since the user still exists.
    const pending = this.reconnectTimers.get(connection.id);
    if (pending !== undefined) {
      clearTimeout(pending);
      this.reconnectTimers.delete(connection.id);
    }

    this.apply({ type: "UserEntered", user: createUser(connection.id) });
  }

  onClose(connection: Party.Connection) {
    // Don't remove the user immediately. Start a grace timer so a page refresh
    // or brief network drop does not wipe their score and guesses. If they
    // don't come back within the grace period, remove them for real.
    const userId = connection.id;
    if (this.reconnectTimers.has(userId)) return;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(userId);
      this.apply({ type: "UserExit", user: createUser(userId) });
    }, Server.RECONNECT_GRACE_MS);

    this.reconnectTimers.set(userId, timer);
  }

  onMessage(message: string, sender: Party.Connection) {
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }

    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      return;
    }

    // Only actions a player is allowed to send get through; the turn clock is
    // the room's to fire, not theirs.
    const { type } = payload as { type: unknown };
    if (typeof type !== "string" || !CLIENT_ACTION_TYPES.has(type)) {
      return;
    }

    this.apply({
      ...(payload as object),
      user: createUser(sender.id),
    } as ServerAction);
  }
}

Server satisfies Party.Worker;
