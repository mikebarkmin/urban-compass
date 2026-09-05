import { ClientGameState, handSizeFor } from "../../game/logic";
import { useT } from "@/i18n";
import { Emoji } from "./Emoji";
import { Avatar, Badge, cx } from "./ui";

interface PlayerListProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  /** Show per-round progress instead of just the score. */
  showProgress?: boolean;
}

const PlayerList = ({ gameState, username, roomId, showProgress }: PlayerListProps) => {
  const t = useT();
  const ranked = [...gameState.users].sort((a, b) => b.score - a.score);
  const totalCards = handSizeFor(gameState);

  return (
    <ul className="space-y-1.5">
      {ranked.map((user) => {
        const isYou = user.id === username;
        const isActive = gameState.currentTurnUserId === user.id;
        const isDone = gameState.completedTurns.includes(user.id);

        return (
          <li
            key={user.id}
            className={cx(
              "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
              isActive
                ? "border-beacon-500/50 bg-beacon-500/10"
                : "border-transparent bg-chart-850/60",
            )}
          >
            <Avatar
              name={user.id}
              seed={user.id + roomId}
              avatar={user.avatar}
              ring={isActive ? "active" : isDone ? "done" : null}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm text-chart-100">{user.id}</span>
                {isYou && <span className="text-[10px] text-chart-500">{t("players.you")}</span>}
                {gameState.hostId === user.id && (
                  <span title={t("players.host")}>
                    <Emoji symbol="👑" alt={t("players.host")} className="inline h-3.5 w-3.5 align-[-2px]" />
                  </span>
                )}
              </div>
              {showProgress && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 w-full max-w-24 overflow-hidden rounded-full bg-chart-800">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all duration-500",
                        isDone ? "bg-signal-500" : "bg-beacon-500",
                      )}
                      style={{
                        width: `${(Math.min(totalCards, user.placedGuesses.length + user.burned) / Math.max(1, totalCards)) * 100}%`,
                      }}
                    />
                  </div>
                  {user.doubleDownAvailable && (
                    <span
                      className="shrink-0 font-display text-[10px] font-bold text-beacon-400"
                      title={t("players.doubleLeft")}
                    >
                      2×
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-chart-500">
                    {user.placedGuesses.length}/{totalCards}
                    {user.burned > 0 && (
                      <span className="text-alert-500" title={t("players.lost", { count: user.burned })}>
                        {" "}
                        −{user.burned}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {isActive ? (
              <Badge tone="beacon">{t("players.onTurn")}</Badge>
            ) : isDone ? (
              <Badge tone="signal">{t("players.done")}</Badge>
            ) : null}

            <span className="w-10 text-right font-display text-sm font-bold tabular-nums text-chart-100">
              {user.score}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default PlayerList;
