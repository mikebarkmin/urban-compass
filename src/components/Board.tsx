import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Action,
  ClientGameState,
  cardsLeftFor,
  effectiveTurnSeconds,
  handSizeFor,
  roundsRemaining,
} from "../../game/logic";
import { Category, categoryIcons, cityName } from "../../game/cities";
import { useLocale } from "@/i18n";
import { useSound } from "@/hooks/useSound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { Avatar, Panel, cx } from "./ui";
import { useFixedTopBar } from "./Layout";
import ActionFlash from "./ActionFlash";
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

/** One of the player's own chips they are about to move with a power-up. */
interface SwapFrom {
  category: Category;
  cityId: string;
}

/** The action the player has chosen for this turn. Must be picked first. */
type ActionMode = "place" | "steal" | "doubt" | "swap" | "sit_out";

/**
 * The two fixed bars are the top and bottom edge of one turn frame, so they
 * are cut from one material: an amber slab while the player is on the clock,
 * dark chrome otherwise, a hairline of the same ink on the board-facing edge,
 * and no drop shadow on either. Anything that only one of them carries — a
 * heavy shadow, a different border — makes them read as two unrelated
 * components stuck to opposite ends of the screen.
 */
const barSurface = (accent: boolean) =>
  cx(
    "fixed inset-x-0 backdrop-blur",
    accent ? "border-chart-950/15 bg-beacon-500" : "border-chart-700 bg-chart-950/95",
  );

/** The row inside a bar. Identical rhythm top and bottom. */
const BAR_ROW = "mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3";

/**
 * Controls sitting on the amber slab. Dark ink on amber is the whole
 * vocabulary: solid for the one commit action, outlined for everything else.
 */
// `tap-target` only fires on a coarse pointer, so the padding here has to
// stand on its own for mouse users.
const ACCENT_PILL = "tap-target inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors";
const ACCENT_PILL_SOLID = "border border-chart-950 bg-chart-950 text-beacon-400 hover:bg-chart-900";
const ACCENT_PILL_OUTLINE = "border border-chart-950/30 text-chart-900 hover:bg-chart-950/10";

/**
 * A small circled-i info icon that shows a popover on tap or click. Native
 * `title` tooltips do not fire on touch devices, so this uses a real
 * click-to-toggle bubble with click-outside dismissal instead.
 */
const InfoIcon = ({ label }: { label: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative ml-1 inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-label={label}
        aria-expanded={open}
        className="inline-grid h-5 w-5 place-items-center rounded-full border border-current text-[10px] font-bold leading-none opacity-60 transition-opacity hover:opacity-100"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-chart-600 bg-chart-900 px-3 py-2 text-xs font-normal leading-relaxed text-chart-200 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </span>
      )}
    </span>
  );
};

const Board = ({ gameState, username, roomId, clockOffset, dispatch }: BoardProps) => {
  const { locale, t } = useLocale();
  useFixedTopBar();
  // The board is only mounted while a game is in progress.
  useWakeLock(true);
  const { play } = useSound();
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [doubling, setDoubling] = useState(false);
  const [stealTarget, setStealTarget] = useState<StealTarget | null>(null);
  const [doubtTarget, setDoubtTarget] = useState<StealTarget | null>(null);
  const [swapFrom, setSwapFrom] = useState<SwapFrom | null>(null);
  const [pendingCityId, setPendingCityId] = useState<string | null>(null);
  const [pendingStealCategory, setPendingStealCategory] = useState<Category | null>(null);
  const [pendingSwapTo, setPendingSwapTo] = useState<string | null>(null);

  const me = gameState.users.find((u) => u.id === username);
  const avatarOf = (userId: string) => gameState.users.find((u) => u.id === userId)?.avatar;
  const isMyTurn = gameState.currentTurnUserId === username;
  const iAmDone = gameState.completedTurns.includes(username);
  const activePlayer = gameState.currentTurnUserId;
  const myGuesses = gameState.categoryGuesses[username] ?? {};

  const handSize = handSizeFor(gameState);
  const cardsLeft = me ? cardsLeftFor(me, handSize) : 0;
  const burned = me?.burned ?? 0;

  const canAct = isMyTurn && !iAmDone && cardsLeft > 0;
  const stealsOn = gameState.settings.steals;
  const doubtsOn = gameState.settings.doubts;
  const powerUpsOn = gameState.settings.powerUps;
  const canDouble = gameState.settings.doubleDown !== "off" && !!me?.doubleDownAvailable;
  const hasPlacedChip = (me?.placedGuesses ?? []).length > 0;
  const canPowerUp = canAct && powerUpsOn && !me?.powerUpUsed && hasPlacedChip;

  const totalRounds =
    gameState.roundNumber +
    roundsRemaining(gameState.users, gameState.starterCounts, gameState.settings.cycles);

  const reset = () => {
    setActionMode(null);
    setSelectedCategory(null);
    setDoubling(false);
    setStealTarget(null);
    setDoubtTarget(null);
    setSwapFrom(null);
    setPendingCityId(null);
    setPendingStealCategory(null);
    setPendingSwapTo(null);
  };

  const selectMode = (mode: ActionMode) => {
    if (!canAct) return;
    if (mode === "swap" && !canPowerUp) return;
    setActionMode((current) => (current === mode ? null : mode));
    setSelectedCategory(null);
    setDoubling(false);
    setStealTarget(null);
    setDoubtTarget(null);
    setSwapFrom(null);
    setPendingCityId(null);
    setPendingStealCategory(null);
    setPendingSwapTo(null);
  };

  // A staged action dies with the turn: the clock can run out, or the server
  // can move on, while a selection is half-made. Clearing it also stops the
  // amber bottom bar from hanging on under a top bar that has gone dark —
  // two ends of the turn frame disagreeing about whose turn it is.
  useEffect(() => {
    if (!canAct) reset();
    // `reset` is rebuilt every render; the turn flipping is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  // --- Place ---
  const stageCity = (cityId: string) => {
    if (actionMode !== "place" || !selectedCategory) return;
    setPendingCityId((current) => (current === cityId ? null : cityId));
  };

  const confirmPlace = () => {
    if (actionMode !== "place" || !selectedCategory || !pendingCityId) return;
    dispatch({
      type: "place_guess",
      category: selectedCategory,
      cityId: pendingCityId,
      ...(doubling && canDouble ? { doubled: true } : {}),
    });
    play("flip");
    reset();
  };

  // --- Steal ---
  const confirmSteal = () => {
    if (actionMode !== "steal" || !stealTarget || !pendingStealCategory) return;
    dispatch({
      type: "steal",
      targetUserId: stealTarget.userId,
      cityId: stealTarget.cityId,
      category: pendingStealCategory,
    });
    reset();
  };

  // --- Doubt ---
  const confirmDoubt = () => {
    if (actionMode !== "doubt" || !doubtTarget) return;
    dispatch({
      type: "doubt",
      targetUserId: doubtTarget.userId,
      cityId: doubtTarget.cityId,
    });
    play("doubt");
    reset();
  };

  // --- Swap ---
  const stageSwapDestination = (toCityId: string) => {
    if (actionMode !== "swap" || !swapFrom || toCityId === swapFrom.cityId) return;
    setPendingSwapTo((current) => (current === toCityId ? null : toCityId));
  };

  const confirmSwap = () => {
    if (actionMode !== "swap" || !swapFrom || !pendingSwapTo) return;
    dispatch({
      type: "swap_chip",
      category: swapFrom.category,
      fromCityId: swapFrom.cityId,
      toCityId: pendingSwapTo,
    });
    play("swap");
    reset();
  };

  // --- Sit out ---
  const confirmSitOut = () => {
    dispatch({ type: "end_turn" });
    reset();
  };

  // --- Derived display values ---
  const stealCity = stealTarget && gameState.cities.find((c) => c.id === stealTarget.cityId);
  const doubtCity = doubtTarget && gameState.cities.find((c) => c.id === doubtTarget.cityId);
  const swapFromCity = swapFrom && gameState.cities.find((c) => c.id === swapFrom.cityId);
  const pendingCity = pendingCityId && gameState.cities.find((c) => c.id === pendingCityId);
  const swapToCity = pendingSwapTo && gameState.cities.find((c) => c.id === pendingSwapTo);

  // Whether the current action is complete and ready to confirm.
  const canConfirm =
    (actionMode === "place" && !!selectedCategory && !!pendingCityId) ||
    (actionMode === "steal" && !!stealTarget && !!pendingStealCategory) ||
    (actionMode === "doubt" && !!doubtTarget) ||
    (actionMode === "swap" && !!swapFrom && !!pendingSwapTo) ||
    actionMode === "sit_out";

  // The progressive guidance message the bottom bar shows for the current step.
  const stepMessage = (): string => {
    switch (actionMode) {
      case "place":
        if (pendingCity) return t("board.placingOn", { city: cityName(pendingCity, locale) });
        return selectedCategory ? t("board.step.placeCard") : t("board.step.selectCard");
      case "steal":
        if (pendingStealCategory)
          return t("board.hand.sub.naming", {
            player: stealTarget?.userId ?? "",
            city: stealCity ? cityName(stealCity, locale) : "",
          });
        return stealTarget ? t("board.step.nameCard") : t("board.step.pickChip");
      case "doubt":
        if (doubtTarget)
          return t("board.doubtOnCity", {
            player: doubtTarget.userId,
            city: doubtCity ? cityName(doubtCity, locale) : "",
          });
        return t("board.step.pickDoubtChip");
      case "swap":
        if (swapToCity)
          return `${cityName(swapFromCity!, locale)} \u2192 ${cityName(swapToCity, locale)}`;
        return swapFrom ? t("board.step.pickDestination") : t("board.step.pickYourChip");
      case "sit_out":
        return t("board.step.sitOutConfirm");
      default:
        return "";
    }
  };

  const confirmLabel = actionMode === "doubt" ? t("board.doubtConfirm") : t("board.confirm");

  const doConfirm = () => {
    if (actionMode === "steal") confirmSteal();
    else if (actionMode === "doubt") confirmDoubt();
    else if (actionMode === "swap") confirmSwap();
    else if (actionMode === "sit_out") confirmSitOut();
    else confirmPlace();
  };

  // The actions available in the action box.
  const actions: { mode: ActionMode; label: string; info: string; available: boolean }[] = [
    { mode: "place", label: t("board.action.place"), info: t("board.action.place.info"), available: canAct },
    { mode: "steal", label: t("board.callBet"), info: t("board.callBetTitle"), available: canAct && stealsOn },
    { mode: "doubt", label: t("board.doubt"), info: t("board.doubtTitle"), available: canAct && doubtsOn },
    { mode: "swap", label: t("board.swap"), info: t("board.swapTitle"), available: canPowerUp },
    { mode: "sit_out", label: t("board.sitOut"), info: t("board.sitOutTitle"), available: canAct },
  ];

  // Which modes use the hand card grid.
  const naming = actionMode === "steal" && !!stealTarget;
  const pickingSwap = actionMode === "swap" && hasPlacedChip;

  return (
    <>
      {/* Verdict flash for calls and doubts, shown to the whole table. */}
      <ActionFlash log={gameState.log} />

      {/* Turn banner — fixed at the top. Shows round state and whose turn it is.
          The action buttons live in the action box below, not here. */}
      <div
        className={cx(barSurface(canAct), "top-0 z-40 border-b")}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className={BAR_ROW}>
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {activePlayer && (
              <Avatar name={activePlayer} seed={activePlayer + roomId} avatar={avatarOf(activePlayer)} ring="active" size={32} />
            )}
            <div className="min-w-0">
              <div
                className={cx(
                  "truncate font-display text-sm font-bold",
                  canAct ? "text-chart-950" : "text-chart-100",
                )}
              >
                {canAct
                  ? t("board.yourTurn")
                  : iAmDone || cardsLeft === 0
                    ? t("board.outOfCards")
                    : t("board.playing", { player: activePlayer ?? "" })}
              </div>
              <div
                className={cx(
                  "truncate text-xs",
                  canAct ? "text-chart-800" : "text-chart-400",
                )}
              >
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

          {gameState.turnEndsAt !== null && gameState.settings.turnSeconds > 0 && (
            <TurnClock
              endsAt={gameState.turnEndsAt}
              totalSeconds={effectiveTurnSeconds(gameState.settings)}
              clockOffset={clockOffset}
              mine={isMyTurn}
              onAccent={canAct}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:grid-cols-[1fr_320px] lg:pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <div className="space-y-4">
          {/* Action box — the player picks what to do this turn before touching
              the board. Each button has an info icon explaining the action. */}
          <Panel title={t("board.action.title")} subtitle={t("board.action.subtitle")}>
            <div className="flex flex-wrap gap-2">
              {actions.map(({ mode, label, info, available }) => {
                const active = actionMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={!available}
                    onClick={() => selectMode(mode)}
                    aria-label={label}
                    className={cx(
                      "tap-target inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all sm:px-5 sm:py-3",
                      active
                        ? "-translate-y-0.5 border-beacon-500 bg-beacon-500/15 text-beacon-200 shadow-lg shadow-beacon-500/20"
                        : available
                          ? "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-chart-400 text-chart-200"
                          : "cursor-not-allowed border-chart-800 bg-chart-900 text-chart-600",
                    )}
                  >
                    {label}
                    <InfoIcon label={info} />
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Hand */}
          <Panel
            title={t("board.hand.title")}
            subtitle={
              !canAct
                ? cardsLeft === 0
                  ? t("board.hand.sub.spent", { count: handSize })
                  : t("board.hand.sub.waiting", { left: cardsLeft, hand: handSize })
                : actionMode === "place"
                  ? selectedCategory
                    ? t("board.hand.sub.pickCity")
                    : t("board.hand.sub.pickCard", { left: cardsLeft, hand: handSize })
                  : actionMode === "steal" && stealTarget
                    ? t("board.hand.sub.naming", {
                        player: stealTarget.userId,
                        city: stealCity ? cityName(stealCity, locale) : "",
                      })
                    : actionMode === "swap"
                      ? t("board.hand.sub.swapPickChip")
                      : t("board.hand.title")
            }
          >
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {gameState.categories.map((category) => {
                const placedOn = myGuesses[category]?.cityId;
                const placedCity = gameState.cities.find((c) => c.id === placedOn);
                const wasDoubled = myGuesses[category]?.doubled;
                const isSelected = selectedCategory === category;
                const swapPicked = swapFrom?.category === category;

                const usable = naming
                  ? !placedOn
                  : pickingSwap
                    ? !!placedOn
                    : actionMode === "place" && !placedOn;

                return (
                  <button
                    key={category}
                    type="button"
                    disabled={!usable}
                    onClick={() => {
                      if (naming) {
                        setPendingStealCategory((c) => (c === category ? null : category));
                      } else if (pickingSwap) {
                        setSwapFrom(swapPicked ? null : { category, cityId: placedOn! });
                      } else {
                        setSelectedCategory(isSelected ? null : category);
                      }
                    }}
                    className={cx(
                      "group relative rounded-xl border px-3 py-4 text-left transition-all sm:w-[104px] sm:py-3",
                      swapPicked
                        ? "-translate-y-1 border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20"
                        : isSelected
                          ? "-translate-y-1 border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20"
                          : placedOn
                            ? "border-signal-500/40 bg-signal-500/10"
                            : usable
                              ? "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-chart-400"
                              : "border-chart-800 bg-chart-900",
                      !usable && !placedOn && "opacity-50",
                      naming && usable && "hover:border-alert-500 hover:bg-alert-500/10",
                      pickingSwap && !swapPicked && "hover:border-beacon-500 hover:bg-beacon-500/10",
                    )}
                  >
                    <span
                      className={cx(
                        "font-display text-2xl leading-none",
                        swapPicked || isSelected
                          ? "text-beacon-400"
                          : placedOn
                            ? "text-signal-400"
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
          </Panel>

          {/* Cities */}
          <Panel
            title={t("board.title")}
            subtitle={t(
              actionMode === "steal"
                ? "board.subSteal"
                : actionMode === "doubt"
                  ? "board.subDoubt"
                  : actionMode === "swap"
                    ? "board.subSwap"
                    : "board.sub",
            )}
          >
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {gameState.cities.map((city) => {
                const queue = gameState.queues[city.id] ?? [];
                const myBets = (me?.placedGuesses ?? []).filter((g) => g.cityId === city.id);
                const targetable = actionMode === "place" && !!selectedCategory;
                const isPending = pendingCityId === city.id;
                const isSwapDestination = pendingSwapTo === city.id;
                const stealable = actionMode === "steal" && !stealTarget;
                const doubtable = actionMode === "doubt" && !doubtTarget;
                const swapDestination = actionMode === "swap" && !!swapFrom && swapFrom.cityId !== city.id;
                const isSwapSource = actionMode === "swap" && swapFrom?.cityId === city.id;
                const opponentChips = queue.filter((g) => g.userId !== username);
                const active = targetable || swapDestination;

                return (
                  <div
                    key={city.id}
                    className={cx(
                      "rounded-xl border transition-all",
                      isSwapSource
                        ? "border-beacon-500 bg-beacon-500/10"
                        : isPending || isSwapDestination
                          ? "border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20"
                          : targetable
                            ? "border-chart-600 bg-chart-850 hover:-translate-y-0.5 hover:border-beacon-500"
                            : swapDestination
                              ? "border-beacon-500/60 bg-chart-850 hover:-translate-y-0.5 hover:border-beacon-500"
                              : "border-chart-800 bg-chart-900/70",
                      myBets.length > 0 && "border-signal-500/30",
                    )}
                  >
                    <button
                      type="button"
                      disabled={!active}
                      onClick={() =>
                        swapDestination
                          ? stageSwapDestination(city.id)
                          : targetable
                            ? stageCity(city.id)
                            : undefined
                      }
                      className={cx(
                        "w-full p-2.5 text-left sm:p-3",
                        active ? "cursor-pointer" : "cursor-default",
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
                        {queue.length === 0 && !isPending ? (
                          <span className="text-[11px] text-chart-600">{t("board.noBets")}</span>
                        ) : (
                          <>
                            {queue.map((guess, index) => (
                              <span
                                key={`${guess.userId}-${index}`}
                                className="inline-flex items-center gap-0.5"
                              >
                                <Avatar
                                  name={guess.userId}
                                  seed={guess.userId + roomId}
                                  avatar={avatarOf(guess.userId)}
                                  size={20}
                                />
                                {guess.doubled && (
                                  <span
                                    className="font-display text-[10px] font-bold text-beacon-400"
                                    aria-label={t("board.doubledHere", { player: guess.userId })}
                                  >
                                    2×
                                  </span>
                                )}
                              </span>
                            ))}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-beacon-500 bg-beacon-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-beacon-200">
                                <Avatar name={username} seed={username + roomId} avatar={avatarOf(username)} size={16} />
                                {t("board.placeHere")}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {myBets.length > 0 && (
                        <div className="mt-2 text-[10px] text-signal-400">
                          {t("board.yourCardsHere", { count: myBets.length })}
                        </div>
                      )}
                    </button>

                    {/* Steals and doubts both pick an opponent's chip; they live
                        outside the placing button so the two never nest. */}
                    {(stealable || doubtable) && opponentChips.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-chart-800 px-3 py-2.5">
                        <span className="text-[10px] tracking-wide text-chart-500 uppercase">
                          {stealable ? t("board.call") : t("board.doubt")}
                        </span>
                        {opponentChips.map((guess, index) => (
                          <button
                            key={`${guess.userId}-${index}`}
                            type="button"
                            aria-label={
                              stealable
                                ? t("board.callTitle", { player: guess.userId })
                                : t("board.doubtTitleChip", { player: guess.userId })
                            }
                            onClick={() =>
                              stealable
                                ? setStealTarget({ userId: guess.userId, cityId: city.id })
                                : setDoubtTarget({ userId: guess.userId, cityId: city.id })
                            }
                            className={cx(
                              "tap-target grid place-items-center rounded-full p-1 ring-offset-2 ring-offset-chart-900 transition-all hover:ring-2 sm:p-0.5",
                              stealable ? "hover:ring-alert-500" : "hover:ring-beacon-500",
                            )}
                          >
                            <Avatar name={guess.userId} seed={guess.userId + roomId} avatar={avatarOf(guess.userId)} size={28} />
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

      {/* Unified bottom bar — shows the current step's guidance and a confirm
          button. Every action flows through here once its selection is staged. */}
      {actionMode && (
        <div
          className={cx(barSurface(true), "bottom-0 z-50 border-t")}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className={cx(BAR_ROW, "flex-wrap")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Current selection badges */}
              {actionMode === "place" && selectedCategory && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  <span className="text-base">{categoryIcons[selectedCategory]}</span>
                  {t(`card.${selectedCategory}.short`)}
                </span>
              )}
              {actionMode === "steal" && stealTarget && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  <Avatar name={stealTarget.userId} seed={stealTarget.userId + roomId} avatar={avatarOf(stealTarget.userId)} size={18} />
                  {stealCity ? cityName(stealCity, locale) : ""}
                </span>
              )}
              {actionMode === "steal" && pendingStealCategory && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  {categoryIcons[pendingStealCategory]} {t(`card.${pendingStealCategory}.short`)}
                </span>
              )}
              {actionMode === "doubt" && doubtTarget && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  <Avatar name={doubtTarget.userId} seed={doubtTarget.userId + roomId} avatar={avatarOf(doubtTarget.userId)} size={18} />
                  {doubtCity ? cityName(doubtCity, locale) : ""}
                </span>
              )}
              {actionMode === "swap" && swapFrom && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-chart-950/20 bg-chart-950/10 px-2.5 py-1 text-sm font-semibold text-chart-950">
                  <span className="text-base">{categoryIcons[swapFrom.category]}</span>
                  {t(`card.${swapFrom.category}.short`)}
                </span>
              )}

              {/* Step guidance */}
              <span
                className={cx(
                  "min-w-0 truncate text-sm",
                  canConfirm ? "font-medium text-chart-900" : "text-chart-800",
                )}
              >
                {stepMessage()}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              {/* 2× toggle (place only, city staged) */}
              {actionMode === "place" && selectedCategory && pendingCityId && canDouble && (
                <button
                  type="button"
                  onClick={() => setDoubling((on) => !on)}
                  aria-label={t(
                    gameState.settings.wrongGuessPenalty > 0
                      ? "board.doubleTitleRisk"
                      : "board.doubleTitle",
                  )}
                  className={cx(ACCENT_PILL, doubling ? ACCENT_PILL_SOLID : ACCENT_PILL_OUTLINE)}
                >
                  2× {doubling ? t("board.doubleOn") : t("board.doubleDown")}
                </button>
              )}

              <button type="button" className={cx(ACCENT_PILL, ACCENT_PILL_OUTLINE)} onClick={reset}>
                {t("board.cancel")}
              </button>

              <button
                type="button"
                disabled={!canConfirm}
                onClick={doConfirm}
                className={cx(
                  ACCENT_PILL,
                  "font-bold",
                  canConfirm
                    ? ACCENT_PILL_SOLID
                    : "cursor-not-allowed border border-chart-950/20 bg-chart-950/10 text-chart-700",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Board;
