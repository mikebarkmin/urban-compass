import { useState, type RefObject } from "react";
import {
  Action,
  ClientGameState,
  cardsLeftFor,
  handSizeFor,
  roundsRemaining,
} from "../../game/logic";
import { Category, categoryIcons, cityName } from "../../game/cities";
import { useLocale } from "@/i18n";
import { Avatar, Badge, Button, Panel, cx } from "./ui";
import PlayerList from "./PlayerList";
import ActivityLog from "./ActivityLog";
import TurnClock from "./TurnClock";

interface BoardProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  clockOffset: RefObject<number>;
  dispatch: (action: Action) => void;
}

/** The opponent bet a player is about to put a name to. */
interface StealTarget {
  userId: string;
  cityId: string;
}

const Board = ({ gameState, username, roomId, clockOffset, dispatch }: BoardProps) => {
  const { locale, t } = useLocale();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [doubling, setDoubling] = useState(false);
  const [stealing, setStealing] = useState(false);
  const [stealTarget, setStealTarget] = useState<StealTarget | null>(null);

  const me = gameState.users.find((u) => u.id === username);
  const isMyTurn = gameState.currentTurnUserId === username;
  const iAmDone = gameState.completedTurns.includes(username);
  const activePlayer = gameState.currentTurnUserId;
  const myGuesses = gameState.categoryGuesses[username] ?? {};

  const handSize = handSizeFor(gameState);
  const cardsLeft = me ? cardsLeftFor(me, handSize) : 0;
  const burned = me?.burned ?? 0;

  const canAct = isMyTurn && !iAmDone && cardsLeft > 0;
  const canPlace = canAct && !stealing;
  const stealsOn = gameState.settings.steals;
  const canDouble = gameState.settings.doubleDown !== "off" && !!me?.doubleDownAvailable;

  // The rounds still owed grow if somebody joins mid-game, so the total is
  // recomputed rather than frozen when the game started.
  const totalRounds =
    gameState.roundNumber +
    roundsRemaining(gameState.users, gameState.starterCounts, gameState.settings.cycles);

  const reset = () => {
    setSelectedCategory(null);
    setDoubling(false);
    setStealTarget(null);
  };

  const place = (cityId: string) => {
    if (!selectedCategory || !canPlace) return;
    dispatch({
      type: "place_guess",
      category: selectedCategory,
      cityId,
      ...(doubling && canDouble ? { doubled: true } : {}),
    });
    reset();
  };

  const callBet = (category: Category) => {
    if (!stealTarget) return;
    dispatch({
      type: "steal",
      targetUserId: stealTarget.userId,
      cityId: stealTarget.cityId,
      category,
    });
    setStealing(false);
    reset();
  };

  const leaveStealMode = () => {
    setStealing(false);
    setStealTarget(null);
  };

  const stealCity = stealTarget && gameState.cities.find((c) => c.id === stealTarget.cityId);

  const handSubtitle = () => {
    if (stealTarget && stealCity) {
      return t("board.hand.sub.naming", {
        player: stealTarget.userId,
        city: cityName(stealCity, locale),
      });
    }
    if (stealing) return t("board.hand.sub.stealing");
    if (!canPlace) {
      return cardsLeft === 0
        ? t("board.hand.sub.spent", { count: handSize })
        : t("board.hand.sub.waiting", { left: cardsLeft, hand: handSize });
    }
    return selectedCategory
      ? t("board.hand.sub.pickCity")
      : t("board.hand.sub.pickCard", { left: cardsLeft, hand: handSize });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Turn banner */}
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
            canAct ? "border-beacon-500/60 bg-beacon-500/10" : "border-chart-700 bg-chart-850/60",
          )}
        >
          <div className="flex items-center gap-3">
            {activePlayer && (
              <Avatar name={activePlayer} seed={activePlayer + roomId} ring="active" size={32} />
            )}
            <div>
              <div className="font-display text-sm font-semibold text-chart-100">
                {canAct
                  ? stealing
                    ? t("board.calling")
                    : t("board.yourTurn")
                  : iAmDone || cardsLeft === 0
                    ? t("board.outOfCards")
                    : t("board.playing", { player: activePlayer ?? "" })}
              </div>
              <div className="text-xs text-chart-400">
                {t("board.meta", {
                  round: gameState.roundNumber,
                  total: totalRounds,
                  set:
                    gameState.citySetId === "custom"
                      ? gameState.citySetName
                      : t(`set.${gameState.citySetId}.name`),
                  count: gameState.cities.length,
                })}
                {gameState.roundStarterId && (
                  <span className="hidden sm:inline">
                    {t("board.opened", { player: gameState.roundStarterId })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {gameState.turnEndsAt !== null && gameState.settings.turnSeconds > 0 && (
              <TurnClock
                endsAt={gameState.turnEndsAt}
                totalSeconds={gameState.settings.turnSeconds}
                clockOffset={clockOffset}
                mine={isMyTurn}
              />
            )}

            {canAct && stealsOn && (
              <Button
                variant={stealing ? "primary" : "secondary"}
                size="sm"
                title={t("board.callBetTitle")}
                onClick={() => {
                  if (stealing) {
                    leaveStealMode();
                  } else {
                    setStealing(true);
                    setSelectedCategory(null);
                    setDoubling(false);
                  }
                }}
              >
                {stealing ? t("board.neverMind") : t("board.callBet")}
              </Button>
            )}

            {canAct && !stealing && (
              <Button
                variant="secondary"
                size="sm"
                title={t("board.sitOutTitle")}
                onClick={() => dispatch({ type: "end_turn" })}
              >
                {t("board.sitOut")}
              </Button>
            )}
          </div>
        </div>

        {/* Hand */}
        <Panel
          title={stealTarget ? t("board.hand.naming") : t("board.hand.title")}
          subtitle={handSubtitle()}
        >
          <div className="flex flex-wrap gap-2">
            {gameState.categories.map((category) => {
              const placedOn = myGuesses[category]?.cityId;
              const placedCity = gameState.cities.find((c) => c.id === placedOn);
              const wasDoubled = myGuesses[category]?.doubled;
              const isSelected = selectedCategory === category;

              // While naming an opponent's bet, the hand becomes the guess
              // picker; cards already in front of you cannot be the answer.
              const naming = !!stealTarget;
              const usable = naming ? !placedOn : canPlace && !placedOn;

              return (
                <button
                  key={category}
                  type="button"
                  disabled={!usable}
                  onClick={() =>
                    naming ? callBet(category) : setSelectedCategory(isSelected ? null : category)
                  }
                  className={cx(
                    "group relative w-[104px] rounded-xl border px-3 py-3 text-left transition-all",
                    placedOn
                      ? "border-signal-500/40 bg-signal-500/10"
                      : isSelected
                        ? "-translate-y-1 border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20"
                        : usable
                          ? "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-chart-400"
                          : "border-chart-800 bg-chart-900",
                    !usable && !placedOn && "opacity-50",
                    naming && usable && "hover:border-alert-500 hover:bg-alert-500/10",
                  )}
                >
                  <span
                    className={cx(
                      "font-display text-2xl leading-none",
                      placedOn
                        ? "text-signal-400"
                        : isSelected
                          ? "text-beacon-400"
                          : "text-chart-400",
                    )}
                  >
                    {categoryIcons[category]}
                  </span>
                  <span className="mt-2 block text-xs leading-tight font-medium text-chart-200">
                    {t(`card.${category}.short`)}
                  </span>
                  {placedCity && (
                    <span className="mt-1.5 block truncate text-[10px] text-signal-400">
                      → {cityName(placedCity, locale)}
                      {wasDoubled && <span className="ml-1 text-beacon-400">2×</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {burned > 0 && (
            <p className="mt-3 text-[11px] text-alert-500">
              {t("board.cardsLost", { count: burned })}
            </p>
          )}

          {selectedCategory && !stealTarget && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-chart-400">
              <Badge tone="beacon">
                {categoryIcons[selectedCategory]} {t(`card.${selectedCategory}.short`)}
              </Badge>
              <span>{t("board.selected")}</span>

              {canDouble && (
                <button
                  type="button"
                  onClick={() => setDoubling((on) => !on)}
                  title={t(
                    gameState.settings.wrongGuessPenalty > 0
                      ? "board.doubleTitleRisk"
                      : "board.doubleTitle",
                  )}
                  className={cx(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    doubling
                      ? "border-beacon-500 bg-beacon-500 text-chart-950"
                      : "border-beacon-500/50 text-beacon-300 hover:bg-beacon-500/10",
                  )}
                >
                  2× {doubling ? t("board.doubleOn") : t("board.doubleDown")}
                </button>
              )}

              <button
                className="text-chart-500 underline hover:text-chart-300"
                onClick={reset}
              >
                {t("board.cancel")}
              </button>
            </div>
          )}

          {stealTarget && (
            <div className="mt-3 flex items-center gap-2 text-xs text-chart-400">
              <Badge tone="neutral">
                <Avatar
                  name={stealTarget.userId}
                  seed={stealTarget.userId + roomId}
                  size={14}
                />
                {t("board.onCity", {
                  player: stealTarget.userId,
                  city: stealCity ? cityName(stealCity, locale) : "",
                })}
              </Badge>
              <button className="text-chart-500 underline hover:text-chart-300" onClick={reset}>
                {t("board.cancel")}
              </button>
            </div>
          )}
        </Panel>

        {/* Cities */}
        <Panel
          title={t("board.title")}
          subtitle={t(stealing ? "board.subSteal" : "board.sub")}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gameState.cities.map((city) => {
              const queue = gameState.queues[city.id] ?? [];
              const myBets = (me?.placedGuesses ?? []).filter((g) => g.cityId === city.id);
              const targetable = canPlace && !!selectedCategory;
              const stealable = stealing && !stealTarget;
              const opponentChips = queue.filter((g) => g.userId !== username);

              return (
                <div
                  key={city.id}
                  className={cx(
                    "rounded-xl border transition-all",
                    targetable
                      ? "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-beacon-500"
                      : "border-chart-800 bg-chart-900/70",
                    myBets.length > 0 && "border-signal-500/30",
                  )}
                >
                  <button
                    type="button"
                    disabled={!targetable}
                    onClick={() => place(city.id)}
                    className={cx(
                      "w-full p-3 text-left",
                      targetable ? "cursor-pointer" : "cursor-default",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-chart-100">
                        {cityName(city, locale)}
                      </span>
                      {city.country && (
                        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-chart-500">
                          {city.country}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1">
                      {queue.length === 0 ? (
                        <span className="text-[11px] text-chart-600">{t("board.noBets")}</span>
                      ) : (
                        queue.map((guess, index) => (
                          <span
                            key={`${guess.userId}-${index}`}
                            className="inline-flex items-center gap-0.5"
                          >
                            <Avatar
                              name={guess.userId}
                              seed={guess.userId + roomId}
                              size={20}
                            />
                            {guess.doubled && (
                              <span
                                className="font-display text-[10px] font-bold text-beacon-400"
                                title={t("board.doubledHere", { player: guess.userId })}
                              >
                                2×
                              </span>
                            )}
                          </span>
                        ))
                      )}
                    </div>

                    {myBets.length > 0 && (
                      <div className="mt-2 text-[10px] text-signal-400">
                        {t("board.yourCardsHere", { count: myBets.length })}
                      </div>
                    )}
                  </button>

                  {/* Steals live outside the placing button so the two never
                      nest, and so a chip stays a plain avatar the rest of the time. */}
                  {stealable && opponentChips.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-chart-800 px-3 py-2">
                      <span className="text-[10px] tracking-wide text-chart-500 uppercase">
                        {t("board.call")}
                      </span>
                      {opponentChips.map((guess, index) => (
                        <button
                          key={`${guess.userId}-${index}`}
                          type="button"
                          title={t("board.callTitle", { player: guess.userId })}
                          onClick={() =>
                            setStealTarget({ userId: guess.userId, cityId: city.id })
                          }
                          className="rounded-full ring-offset-2 ring-offset-chart-900 transition-all hover:ring-2 hover:ring-alert-500"
                        >
                          <Avatar name={guess.userId} seed={guess.userId + roomId} size={20} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title={t("players.title")}>
          <PlayerList gameState={gameState} username={username} roomId={roomId} showProgress />
        </Panel>
        <ActivityLog log={gameState.log} />
      </div>
    </div>
  );
};

export default Board;
