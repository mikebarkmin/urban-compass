import usePartySocket from "partysocket/react";
import { useCallback, useRef, useState } from "react";
import { Action, ClientGameState } from "../../game/logic";

export type ConnectionStatus = "connecting" | "online" | "offline";

/**
 * Subscribe to a room. The server broadcasts the whole client-facing state on
 * every change, so there is nothing to merge — the last message wins.
 *
 * Alongside the state we track how far this machine's clock sits from the
 * room's, so the turn countdown can be drawn against the server's deadline
 * rather than a local one.
 */
export const useGameRoom = (username: string, roomId: string) => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const clockOffset = useRef(0);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_SERVER_URL || "127.0.0.1:1999",
    room: roomId,
    id: username,
    onOpen() {
      setStatus("online");
    },
    onClose() {
      setStatus("offline");
    },
    onError() {
      setStatus("offline");
    },
    onMessage(event: MessageEvent<string>) {
      try {
        const next = JSON.parse(event.data) as ClientGameState;
        if (typeof next.serverNow === "number") {
          clockOffset.current = next.serverNow - Date.now();
        }
        setGameState(next);
      } catch {
        // A malformed frame is not worth tearing the room down over.
      }
    },
  });

  const dispatch = useCallback(
    (action: Action) => {
      socket.send(JSON.stringify(action));
    },
    [socket],
  );

  return { gameState, dispatch, status, clockOffset };
};
