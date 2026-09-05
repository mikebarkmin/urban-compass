import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Action,
  ClientGameState,
  ContenderResult,
  MIN_PLAYERS,
  RoundOutcome,
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
import { useSound } from "@/hooks/useSound";
import { Avatar, Badge, Button, CardBack, Panel, cx, useCountUp, useReducedMotion } from "./ui";
import GameOver from "./GameOver";
import MiniMap from "./MiniMap";
import ActivityLog from "./ActivityLog";
import Confetti from "./Confetti";

interface ResultsProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  dispatch: (action: Action) => void;
}

/** Pacing for the staged reveal, in milliseconds. */
const INTRO_MS = 1200;
const PER_CATEGORY_MS = 900;
const OUTRO_DELAY_MS = 300;

/** Pacing when the room plays a speed round — the reveal still stages, but fast. */
const SPEED_INTRO_MS = 400;
const SPEED_PER_CATEGORY_MS = 300;
const SPEED_OUTRO_DELAY_MS = 100;

type RevealStage = "intro" | "revealing" | "done";

/**
 * A standings score that counts up from the player's pre-round base to a
 * progressively-increasing target as categories are revealed, then snaps to
 * the final total when the reveal is done. Kept as its own component so the
 * `useCountUp` hook is called once per player, not inside the standings map.
 */
const StandingScore = ({
  userId,
  finalScore,
  baseScore,
  revealedCount,
  outcome,
  done,
}: {
  userId: string;
  finalScore: number;
  baseScore: number;
  revealedCount: number;
  outcome: RoundOutcome | null;
  done: boolean;
}) => {
  const target = useMemo(() => {
    if (done || !outcome) return finalScore;
    let earned = 0;
    for (let i = 0; i < revealedCount && i < outcome.categories.length; i++) {
      const contender = outcome.categories[i].contenders.find(
        (c: ContenderResult) => c.guess.userId === userId,
      );
      if (contender) earned += contender.points;
    }
    return baseScore + earned;
  }, [done, outcome, revealedCount, userId, finalScore, baseScore]);

  const display = useCountUp(target, baseScore, 400);
  return (
    <span className="w-10 text-right font-display text-sm font-bold tabular-nums text-chart-100">
      {display}
    </span>
  );
};

const Results = ({ gameState, username, roomId, dispatch }: ResultsProps) => {
  const { locale, t } = useLocale();
  const isHost = gameState.hostId === username;
  const answers = gameState.correctAnswers;
  const { play } = useSound();
  const reduced = useReducedMotion();

  // Speed round compresses the staged reveal so a fast game does not dwell.
  const introMs = gameState.settings.speedRound ? SPEED_INTRO_MS : INTRO_MS;
  const perCategoryMs = gameState.settings.speedRound ? SPEED_PER_CATEGORY_MS : PER_CATEGORY_MS;
  const outroDelayMs = gameState.settings.speedRound ? SPEED_OUTRO_DELAY_MS : OUTRO_DELAY_MS;

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
            gameState.runnerUps ?? {},
            gameState.doubtBonus,
          )
        : null,
    [
      answers,
      gameState.users,
      gameState.categoryGuesses,
      gameState.categories,
      gameState.settings,
      gameState.runnerUps,
      gameState.doubtBonus,
    ],
  );

  const resultFor = useCallback(
    (category: Category) =>
      outcome?.categories.find((entry) => entry.category === category) ?? null,
    [outcome],
  );

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

  // Only categories that actually have an answer get a card and a reveal step.
  const answerableCategories = useMemo(
    () => gameState.categories.filter((c) => answers?.[c]),
    [gameState.categories, answers],
  );
  const total = answerableCategories.length;

  // Map each category to its position in the reveal order.
  const answerIndexMap = useMemo(() => {
    const map = new Map<Category, number>();
    answerableCategories.forEach((cat, i) => map.set(cat, i));
    return map;
  }, [answerableCategories]);

  const ranked = [...gameState.users].sort((a, b) => b.score - a.score);
  const avatarOf = (userId: string) => gameState.users.find((u) => u.id === userId)?.avatar;
  const leader = ranked[0];
  const finished = gameState.phase === "game_over";

  const remaining = roundsRemaining(
    gameState.users,
    gameState.starterCounts,
    gameState.settings.cycles,
  );
  const totalRounds = gameState.roundNumber + remaining;

  // --- Staged reveal controller ----------------------------------------------
  const [revealStage, setRevealStage] = useState<RevealStage>("intro");
  const [revealedCount, setRevealedCount] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [floatingPoints, setFloatingPoints] = useState<Record<string, number>>({});
  const timersRef = useRef<number[]>([]);
  const playRef = useRef(play);
  playRef.current = play;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const skipReveal = useCallback(() => {
    clearTimers();
    setRevealedCount(total);
    setRevealStage("done");
    setFloatingPoints({});
  }, [clearTimers, total]);

  useEffect(() => {
    if (!outcome || total === 0) {
      setRevealStage("done");
      setRevealedCount(total);
      return;
    }

    if (reduced) {
      setRevealedCount(total);
      setRevealStage("done");
      return;
    }

    // Intro: drumroll, then start revealing.
    playRef.current("drumroll");
    const introTimer = window.setTimeout(() => {
      setRevealStage("revealing");

      answerableCategories.forEach((category, i) => {
        const timer = window.setTimeout(() => {
          setRevealedCount(i + 1);

          // Sound + confetti for this category's resolution.
          const result = outcome.categories[i];
          const contenders = result?.contenders ?? [];
          const hasWinners = contenders.some((c) => c.points > 0);
          const collided = result?.collided;

          playRef.current("flip");
          if (hasWinners && !collided) {
            window.setTimeout(() => playRef.current("chime"), 200);
            setConfettiTrigger((prev) => prev + 1);
          } else if (collided || (contenders.length > 0 && !hasWinners)) {
            window.setTimeout(() => playRef.current("buzz"), 200);
          }

          // Floating +N chips for the standings.
          const chips: Record<string, number> = {};
          for (const c of contenders) {
            if (c.points !== 0) chips[c.guess.userId] = c.points;
          }
          setFloatingPoints(chips);
          window.setTimeout(() => setFloatingPoints({}), 1000);
        }, i * perCategoryMs);
        timersRef.current.push(timer);
      });

      // Outro: mark the reveal complete.
      const outroTimer = window.setTimeout(() => {
        setRevealStage("done");
        setFloatingPoints({});
      }, total * perCategoryMs + outroDelayMs);
      timersRef.current.push(outroTimer);
    }, introMs);
    timersRef.current.push(introTimer);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revealDone = revealStage === "done";
  const revealedCategories = answerableCategories.slice(0, revealedCount);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Confetti trigger={confettiTrigger} count={50} duration={1200} />

      <div className="order-2 space-y-4 lg:order-1">
        {/* Banner area: reveal banner during intro/revealing, then the
            round-over or game-over panel once the reveal is done. */}
        {!revealDone ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-beacon-500/40 bg-beacon-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="animate-drumroll font-display text-base font-bold text-beacon-400"
                aria-hidden
              >
                ◴
              </span>
              <span className="font-display text-sm font-semibold text-chart-100">
                {t("results.reveal.intro", { round: gameState.roundNumber })}
              </span>
            </div>
            <button
              type="button"
              onClick={skipReveal}
              className="text-xs text-chart-400 underline underline-offset-4 transition-colors hover:text-chart-200"
            >
              {t("results.reveal.skip")}
            </button>
          </div>
        ) : finished ? (
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

        {/* Map: blurred during intro, progressive highlights during reveal. */}
        <Panel title={t("results.map.title")} subtitle={t("results.map.sub")}>
          <div
            className={cx(
              "transition-all duration-500",
              revealStage === "intro" && "blur-sm",
            )}
          >
            <MiniMap
              cities={gameState.cities}
              highlights={highlights}
              revealedCategories={revealDone ? undefined : revealedCategories}
              height={300}
            />
          </div>
        </Panel>

        {/* Answer cards: face-down until revealed, then flip to show the answer. */}
        <Panel title={t("results.answers")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {gameState.categories.map((category) => {
              const city = answers?.[category];
              if (!city) return null;
              const result = resultFor(category);
              const contenders = result?.contenders ?? [];
              const answerIndex = answerIndexMap.get(category);
              const isRevealed =
                revealDone || (answerIndex !== undefined && revealedCount > answerIndex);

              // Every player who played a card on this category, split into
              // correct (contenders) and wrong guesses, so the whole table can
              // reason about the round — not just the viewer's own near-miss.
              const allGuesses = Object.entries(gameState.categoryGuesses)
                .filter(([userId, guesses]) => guesses[category])
                .map(([userId, guesses]) => {
                  const guess = guesses[category]!;
                  const guessedCity = gameState.cities.find((c) => c.id === guess.cityId);
                  const isCorrect = guess.cityId === city.id;
                  const contender = contenders.find((c) => c.guess.userId === userId);
                  return {
                    userId,
                    guess,
                    guessedCity: guessedCity ?? null,
                    isCorrect,
                    doubled: !!guess.doubled,
                    points: contender?.points ?? 0,
                    miss:
                      guessedCity && !isCorrect
                        ? missOf(guessedCity, city, category)
                        : null,
                  };
                });

              const wrongGuesses = allGuesses.filter((g) => !g.isCorrect);
              const viewerGotIt = contenders.some(
                (c) => c.guess.userId === username && c.points > 0,
              );

              return (
                <div key={category} className="flip-scene min-h-[110px]">
                  <div
                    className={cx(
                      "flip-card transition-transform duration-500",
                      !isRevealed && "[transform:rotateY(180deg)]",
                    )}
                  >
                    {/* Front face: the answer card. */}
                    <div
                      className={cx(
                        "flip-face rounded-xl border p-3",
                        viewerGotIt && isRevealed
                          ? "border-beacon-500/60 bg-beacon-500/[0.07] shadow-lg shadow-beacon-500/10"
                          : "border-chart-700 bg-chart-850/70",
                      )}
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
                          <span className="font-mono text-[10px] text-chart-500">
                            {city.country}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-chart-500">{evidenceOf(category, city)}</div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {contenders.length === 0 ? (
                          <span className="text-[11px] text-chart-600">
                            {t("results.nobody")}
                          </span>
                        ) : (
                          contenders.map(({ guess, doubled, points }, ci) => (
                            <span
                              key={guess.userId}
                              className={cx(
                                "inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px]",
                                isRevealed && "animate-pop",
                                guess.userId === username
                                  ? "border-beacon-500/50 bg-beacon-500/10 text-beacon-300"
                                  : "border-chart-700 bg-chart-900 text-chart-300",
                              )}
                              style={
                                isRevealed ? { animationDelay: `${ci * 80}ms` } : undefined
                              }
                            >
                              <Avatar
                                name={guess.userId}
                                seed={guess.userId + roomId}
                                avatar={avatarOf(guess.userId)}
                                size={18}
                              />
                              {guess.userId}
                              {doubled && (
                                <span
                                  className="font-semibold text-beacon-400"
                                  title={t("results.doubledTitle")}
                                >
                                  2×
                                </span>
                              )}
                              <span
                                className={cx(
                                  "font-semibold",
                                  points > 0
                                    ? "text-signal-400"
                                    : "text-chart-600 line-through",
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

                      {wrongGuesses.length > 0 && (
                        <div className="mt-2 border-t border-chart-800 pt-2">
                          <div className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-chart-600 uppercase">
                            {t("results.wrong")}
                          </div>
                          <ul className="space-y-1">
                            {wrongGuesses.map(({ userId, guessedCity, miss, doubled }) => (
                              <li
                                key={userId}
                                className={cx(
                                  "flex items-center gap-1.5 text-[11px]",
                                  userId === username
                                    ? "text-chart-200"
                                    : "text-chart-400",
                                )}
                              >
                                <Avatar name={userId} seed={userId + roomId} avatar={avatarOf(userId)} size={16} />
                                <span className="font-medium">{userId}</span>
                                {doubled && (
                                  <span
                                    className="font-semibold text-beacon-400"
                                    title={t("results.doubledTitle")}
                                  >
                                    2×
                                  </span>
                                )}
                                <span className="text-chart-500">→</span>
                                <span className="text-chart-300">
                                  {guessedCity ? cityName(guessedCity, locale) : "?"}
                                </span>
                                {miss && (
                                  <span className="text-chart-600">
                                    ({t(miss.key, { value: miss.value })})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Back face: compass-rose card back, visible while face-down. */}
                    <CardBack icon={categoryIcons[category]} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* All cities: fades in once the reveal is done. */}
        <div
          className={cx(
            "transition-opacity duration-500",
            revealDone ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
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
                      {city.country && (
                        <span className="ml-1.5 text-chart-500">{city.country}</span>
                      )}
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
      </div>

      <div className="order-1 space-y-4 lg:order-2">
        <Panel title={t("results.standings")}>
          <ul className="space-y-1.5">
            {ranked.map((user, index) => {
              const roundTotal = outcome?.totals[user.id]?.total ?? 0;
              const baseScore = user.score - roundTotal;

              return (
                <li
                  key={user.id}
                  className={cx(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2",
                    index === 0 ? "bg-beacon-500/10" : "bg-chart-850/60",
                  )}
                >
                  <span className="w-4 text-center font-display text-xs text-chart-500">
                    {index + 1}
                  </span>
                  <Avatar name={user.id} seed={user.id + roomId} avatar={user.avatar} />
                  <span className="min-w-0 flex-1 truncate text-sm text-chart-100">
                    {user.id}
                    {user.id === username && (
                      <span className="ml-1 text-[10px] text-chart-500">
                        {t("players.you")}
                      </span>
                    )}
                  </span>
                  {/* Round earned/penalty badges: hidden until the reveal is
                      done, so the standings don't spoil the total up front. */}
                  {revealDone &&
                    (() => {
                      const totals = outcome?.totals[user.id];
                      if (
                        !totals ||
                        (totals.earned === 0 && totals.penalty === 0 && totals.consolation === 0)
                      ) {
                        return <span className="text-[11px] text-chart-600">+0</span>;
                      }
                      return (
                        <span className="flex items-center gap-1">
                          {totals.earned > 0 && <Badge tone="signal">+{totals.earned}</Badge>}
                          {totals.consolation > 0 && (
                            <span title={t("results.consolationTitle")}>
                              <Badge tone="beacon">+{totals.consolation}</Badge>
                            </span>
                          )}
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
                  {/* Floating +N chip while a category is resolving. */}
                  {floatingPoints[user.id] !== undefined && (
                    <span
                      key={`${user.id}-${floatingPoints[user.id]}-${revealedCount}`}
                      className="animate-float-up absolute right-12 top-0 font-display text-xs font-bold text-signal-400"
                      aria-hidden
                    >
                      {floatingPoints[user.id] > 0 ? "+" : ""}
                      {floatingPoints[user.id]}
                    </span>
                  )}
                  <StandingScore
                    userId={user.id}
                    finalScore={user.score}
                    baseScore={baseScore}
                    revealedCount={revealedCount}
                    outcome={outcome}
                    done={revealDone}
                  />
                </li>
              );
            })}
          </ul>
        </Panel>

        <ActivityLog log={gameState.log} />
      </div>
    </div>
  );
};

export default Results;
