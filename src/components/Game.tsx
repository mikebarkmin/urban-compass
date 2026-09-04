import { useGameRoom } from "@/hooks/useGameRoom";
import { roundsRemaining } from "../../game/logic";
import { useT } from "@/i18n";
import Lobby from "./Lobby";
import Board from "./Board";
import Results from "./Results";
import { Badge, cx } from "./ui";

interface GameProps {
  username: string;
  roomId: string;
  onLeave: () => void;
}

const STATUS_TONE = {
  connecting: "bg-beacon-500",
  online: "bg-signal-500",
  offline: "bg-alert-500",
} as const;

const Game = ({ username, roomId, onLeave }: GameProps) => {
  const t = useT();
  const { gameState, dispatch, status, clockOffset } = useGameRoom(username, roomId);

  if (gameState === null) {
    return (
      <div className="panel grid place-items-center gap-3 p-16 text-center">
        <span className="animate-bounce text-3xl">⌖</span>
        <p className="text-sm text-chart-400">
          {status === "offline" ? t("game.offline") : t("game.connecting")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <span
              className={cx("h-1.5 w-1.5 rounded-full", STATUS_TONE[status])}
              aria-hidden
            />
            {roomId}
          </Badge>
          <Badge tone="muted">{username}</Badge>
          {gameState.roundNumber > 0 && gameState.phase !== "lobby" && (
            <Badge tone="muted">
              {gameState.phase === "game_over"
                ? t("game.final")
                : t("game.round", {
                    round: gameState.roundNumber,
                    total:
                      gameState.roundNumber +
                      roundsRemaining(
                        gameState.users,
                        gameState.starterCounts,
                        gameState.settings.cycles,
                      ),
                  })}
            </Badge>
          )}
          <Badge tone="muted">
            {gameState.citySetId === "custom"
              ? gameState.citySetName
              : t(`set.${gameState.citySetId}.name`)}
          </Badge>
        </div>

        <button
          onClick={onLeave}
          className="text-xs text-chart-500 underline underline-offset-4 transition-colors hover:text-chart-200"
        >
          {t("game.leave")}
        </button>
      </div>

      {gameState.phase === "lobby" && (
        <Lobby gameState={gameState} username={username} roomId={roomId} dispatch={dispatch} />
      )}
      {gameState.phase === "playing" && (
        <Board
          gameState={gameState}
          username={username}
          roomId={roomId}
          clockOffset={clockOffset}
          dispatch={dispatch}
        />
      )}
      {(gameState.phase === "round_over" || gameState.phase === "game_over") && (
        <Results gameState={gameState} username={username} roomId={roomId} dispatch={dispatch} />
      )}
    </div>
  );
};

export default Game;
