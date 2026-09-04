import { useMemo } from "react";
import {
  Action,
  ClientGameState,
  MIN_PLAYERS,
  roundsRemaining,
  scoreRound,
} from "../../game/logic";
import {
  Category,
  categoryIcons,
  cityName,
  evidenceOf,
  formatCoordinate,
  formatPopulation,
  missOf,
} from "../../game/cities";
import { useLocale } from "@/i18n";
import { Avatar, Badge, Button, Panel, cx } from "./ui";
import GameOver from "./GameOver";
import MiniMap from "./MiniMap";
import ActivityLog from "./ActivityLog";

interface ResultsProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  dispatch: (action: Action) => void;
}

const Results = ({ gameState, username, roomId, dispatch }: ResultsProps) => {
  const { locale, t } = useLocale();
  const isHost = gameState.hostId === username;
  const answers = gameState.correctAnswers;

  // Scored on the client from the same function the server used, so the two
  // can never disagree about who got what.
  const outcome = useMemo(
    () =>
      answers
        ? scoreRound(
            gameState.users,
            gameState.categoryGuesses,
            answers,
            gameState.categories,
            gameState.settings,
          )
        : null,
    [answers, gameState.users, gameState.categoryGuesses, gameState.categories, gameState.settings],
  );

  const resultFor = (category: Category) =>
    outcome?.categories.find((entry) => entry.category === category) ?? null;

  const highlights = useMemo(() => {
    const map: Record<string, Category[]> = {};
    if (!answers) return map;
    for (const category of gameState.categories) {
      const city = answers[category];
      if (!city) continue;
      map[city.id] = [...(map[city.id] ?? []), category];
    }
    return map;
  }, [answers, gameState.categories]);

  const ranked = [...gameState.users].sort((a, b) => b.score - a.score);
  const leader = ranked[0];
  const finished = gameState.phase === "game_over";

  const remaining = roundsRemaining(
    gameState.users,
    gameState.starterCounts,
    gameState.settings.cycles,
  );
  const totalRounds = gameState.roundNumber + remaining;

  // What this player played on each category, to show them their near misses.
  const myGuesses = gameState.categoryGuesses[username] ?? {};

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {finished ? (
          <GameOver
            gameState={gameState}
            username={username}
            roomId={roomId}
            dispatch={dispatch}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal-500/40 bg-signal-500/10 px-4 py-3">
            <div>
              <div className="font-display text-sm font-semibold text-chart-100">
                {t("results.revealed", { round: gameState.roundNumber, total: totalRounds })}
              </div>
              <div className="text-xs text-chart-400">
                {leader &&
                  t("results.leads", {
                    player: leader.id,
                    score: leader.score,
                    count: remaining,
                  })}
              </div>
            </div>
            {isHost ? (
              <Button
                size="sm"
                disabled={gameState.users.length < MIN_PLAYERS}
                onClick={() => dispatch({ type: "next_round" })}
              >
                {t("results.deal")}
              </Button>
            ) : (
              <span className="text-xs text-chart-400">
                {t("results.waiting", { player: gameState.hostId ?? "" })}
              </span>
            )}
          </div>
        )}

        <Panel title={t("results.map.title")} subtitle={t("results.map.sub")}>
          <MiniMap cities={gameState.cities} highlights={highlights} height={300} />
        </Panel>

        <Panel title={t("results.answers")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {gameState.categories.map((category) => {
              const city = answers?.[category];
              if (!city) return null;
              const result = resultFor(category);
              const contenders = result?.contenders ?? [];

              // Only worth showing when this player played the card and missed.
              const myBet = myGuesses[category];
              const myCity = myBet && gameState.cities.find((c) => c.id === myBet.cityId);
              const miss = myCity ? missOf(myCity, city, category) : null;

              return (
                <div
                  key={category}
                  className="animate-rise rounded-xl border border-chart-700 bg-chart-850/70 p-3"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-chart-400 uppercase">
                    <span className="text-beacon-500">{categoryIcons[category]}</span>
                    {t(`card.${category}`)}
                  </div>

                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold text-beacon-400">
                      {cityName(city, locale)}
                    </span>
                    {city.country && (
                      <span className="font-mono text-[10px] text-chart-500">{city.country}</span>
                    )}
                  </div>
                  <div className="text-xs text-chart-500">{evidenceOf(category, city)}</div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {contenders.length === 0 ? (
                      <span className="text-[11px] text-chart-600">{t("results.nobody")}</span>
                    ) : (
                      contenders.map(({ guess, doubled, points }) => (
                        <span
                          key={guess.userId}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px]",
                            guess.userId === username
                              ? "border-beacon-500/50 bg-beacon-500/10 text-beacon-300"
                              : "border-chart-700 bg-chart-900 text-chart-300",
                          )}
                        >
                          <Avatar name={guess.userId} seed={guess.userId + roomId} size={18} />
                          {guess.userId}
                          {doubled && (
                            <span className="font-semibold text-beacon-400" title={t("results.doubledTitle")}>
                              2×
                            </span>
                          )}
                          <span
                            className={cx(
                              "font-semibold",
                              points > 0 ? "text-signal-400" : "text-chart-600 line-through",
                            )}
                          >
                            +{points}
                          </span>
                        </span>
                      ))
                    )}
                  </div>

                  {result?.collided && (
                    <div className="mt-2 text-[11px] text-alert-500">
                      {t("results.collided")}
                    </div>
                  )}

                  {miss && myCity && (
                    <div className="mt-2 border-t border-chart-800 pt-2 text-[11px] text-chart-500">
                      {t("results.youPlayed", {
                        city: cityName(myCity, locale),
                        miss: t(miss.key, { value: miss.value }),
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={t("results.allCities")}>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {[...gameState.cities]
              .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
              .map((city) => (
                <li
                  key={city.id}
                  className={cx(
                    "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
                    highlights[city.id] ? "bg-beacon-500/10" : "bg-chart-900/60",
                  )}
                >
                  <span className="truncate text-chart-200">
                    {cityName(city, locale)}
                    {city.country && <span className="ml-1.5 text-chart-500">{city.country}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-chart-400">
                    {city.latitude !== null && formatCoordinate(city.latitude, "lat")}
                    <span className="text-chart-600"> · </span>
                    {city.longitude !== null && formatCoordinate(city.longitude, "lon")}
                    <span className="text-chart-600"> · </span>
                    {city.population !== null && formatPopulation(city.population)}
                    {city.elevation !== null && (
                      <>
                        <span className="text-chart-600"> · </span>
                        {city.elevation.toLocaleString("en-US")} m
                      </>
                    )}
                    {city.area !== null && (
                      <>
                        <span className="text-chart-600"> · </span>
                        {city.area.toLocaleString("en-US")} km²
                      </>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title={t("results.standings")}>
          <ul className="space-y-1.5">
            {ranked.map((user, index) => (
              <li
                key={user.id}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  index === 0 ? "bg-beacon-500/10" : "bg-chart-850/60",
                )}
              >
                <span className="w-4 text-center font-display text-xs text-chart-500">
                  {index + 1}
                </span>
                <Avatar name={user.id} seed={user.id + roomId} />
                <span className="min-w-0 flex-1 truncate text-sm text-chart-100">
                  {user.id}
                  {user.id === username && (
                    <span className="ml-1 text-[10px] text-chart-500">{t("players.you")}</span>
                  )}
                </span>
                {(() => {
                  const totals = outcome?.totals[user.id];
                  if (!totals || (totals.earned === 0 && totals.penalty === 0)) {
                    return <span className="text-[11px] text-chart-600">+0</span>;
                  }
                  return (
                    <span className="flex items-center gap-1">
                      {totals.earned > 0 && <Badge tone="signal">+{totals.earned}</Badge>}
                      {totals.penalty > 0 && (
                        <span
                          className="rounded-full border border-alert-500/40 bg-alert-500/10 px-2 py-0.5 text-[11px] font-medium text-alert-500"
                          title={t("results.missed", { count: totals.missed })}
                        >
                          −{totals.penalty}
                        </span>
                      )}
                    </span>
                  );
                })()}
                <span className="w-10 text-right font-display text-sm font-bold tabular-nums text-chart-100">
                  {user.score}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <ActivityLog log={gameState.log} />
      </div>
    </div>
  );
};

export default Results;
