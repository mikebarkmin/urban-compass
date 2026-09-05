import { useEffect, useState } from "react";
import { Action, ClientGameState, MIN_PLAYERS } from "../../game/logic";
import { useT } from "@/i18n";
import { useSound } from "@/hooks/useSound";
import { EmojiText } from "./Emoji";
import { Avatar, Badge, Button, cx, useCountUp } from "./ui";
import Confetti from "./Confetti";

interface GameOverProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  dispatch: (action: Action) => void;
}

/**
 * Gold, silver and bronze without leaning on the 🥇🥈🥉 glyphs — those are
 * missing from plenty of emoji fonts and fall back to a tofu box, so the rank
 * is drawn as a numbered badge instead.
 */
const PODIUM = [
  {
    height: "h-20",
    bar: "border-beacon-500/60 bg-beacon-500/15",
    badge: "border-beacon-500 bg-beacon-500 text-chart-950",
  },
  {
    height: "h-14",
    bar: "border-chart-400/50 bg-chart-700",
    badge: "border-chart-300 bg-chart-300 text-chart-950",
  },
  {
    height: "h-10",
    bar: "border-beacon-300/40 bg-chart-800",
    badge: "border-beacon-300/70 bg-beacon-300/80 text-chart-950",
  },
];

/**
 * A single podium score that counts up from zero to its final value. Kept as
 * its own component so the `useCountUp` hook is called once per podium slot,
 * not inside the podium map loop.
 */
const PodiumScore = ({ score }: { score: number }) => {
  const display = useCountUp(score, 0, 600);
  return (
    <span className="font-display text-lg font-bold text-chart-100 tabular-nums">
      {display}
    </span>
  );
};

/**
 * The end of a game: everybody has opened their share of rounds, so the totals
 * are final. Shown above the last round's reveal rather than instead of it, so
 * the answers people are still arguing about stay on screen.
 */
const GameOver = ({ gameState, username, roomId, dispatch }: GameOverProps) => {
  const t = useT();
  const { play } = useSound();
  const isHost = gameState.hostId === username;
  const ranked = [...gameState.users].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  // A draw at the top is worth naming rather than quietly picking a winner.
  const champions = top ? ranked.filter((user) => user.score === top.score) : [];
  const drawn = champions.length > 1;

  // Fire the fanfare and a confetti burst once on mount.
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  useEffect(() => {
    play("fanfare");
    setConfettiTrigger(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Second and third stand either side of the winner, tallest in the middle.
  // Only the places that actually exist get a column, so a two-player game does
  // not leave a hole where the bronze step would be.
  const podium = [
    { user: ranked[1], rank: 1 },
    { user: ranked[0], rank: 0 },
    { user: ranked[2], rank: 2 },
  ].filter((slot): slot is { user: (typeof ranked)[number]; rank: number } => !!slot.user);

  return (
    <div className="animate-rise rounded-xl border border-beacon-500/40 bg-beacon-500/[0.07] p-5">
      <Confetti trigger={confettiTrigger} count={120} duration={2500} origin={{ y: 0.35 }} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold text-chart-100">
            {drawn
              ? t("gameover.draw", {
                  players: champions.map((c) => c.id).join(" · "),
                  score: top.score,
                })
              : top
                ? <EmojiText text={t("gameover.wins", { player: top.id, score: top.score })} emojiClassName="inline h-5 w-5 align-[-3px]" />
                : t("gameover.over")}
          </div>
          <div className="mt-1 text-xs text-chart-400">
            {t("gameover.meta", {
              rounds: t("gameover.rounds", { count: gameState.roundNumber }),
              cycles: t("gameover.turns", { count: gameState.settings.cycles }),
              set:
                gameState.citySetId === "custom"
                  ? gameState.citySetName
                  : t(`set.${gameState.citySetId}.name`),
            })}
          </div>
        </div>

        {isHost ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={gameState.users.length < MIN_PLAYERS}
              onClick={() => dispatch({ type: "start_game" })}
            >
              {t("gameover.playAgain")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "back_to_lobby" })}
            >
              {t("gameover.changeRules")}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-chart-400">
            {t("gameover.waiting", { player: gameState.hostId ?? "" })}
          </span>
        )}
      </div>

      {ranked.length > 1 && (
        <div className="mt-5 flex items-end justify-center gap-2 border-b border-chart-600 sm:gap-4">
          {podium.map(({ user, rank }) => {
            const place = PODIUM[rank];

            return (
              <div key={user.id} className="flex w-24 flex-col items-center gap-1.5 sm:w-28">
                <span
                  className={cx(
                    "grid h-6 w-6 place-items-center rounded-full border font-display text-xs font-bold",
                    place.badge,
                  )}
                  title={t("gameover.place", { rank: rank + 1 })}
                >
                  {rank + 1}
                </span>
                <Avatar
                  name={user.id}
                  seed={user.id + roomId}
                  avatar={user.avatar}
                  size={rank === 0 ? 40 : 32}
                  ring={rank === 0 ? "active" : null}
                />
                <span className="w-full truncate text-center text-xs text-chart-200">
                  {user.id}
                  {user.id === username && (
                    <span className="text-chart-500"> {t("players.you")}</span>
                  )}
                </span>
                <div
                  className={cx(
                    "grid w-full place-items-center rounded-t-lg border-x border-t",
                    place.height,
                    place.bar,
                  )}
                >
                  <PodiumScore score={user.score} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ranked.length > 3 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {ranked.slice(3).map((user, index) => (
            <Badge key={user.id} tone="muted">
              {index + 4}. {user.id} · {user.score}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameOver;
