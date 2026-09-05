import { useState } from "react";
import {
  Action,
  ClientGameState,
  MIN_PLAYERS,
  handSizeFor,
} from "../../game/logic";
import { City, SCORING_VALUES, categoryIcons } from "../../game/cities";
import { Rich, useT } from "@/i18n";
import { Badge, Button, Panel, cx } from "./ui";
import { Emoji } from "./Emoji";
import AvatarEditor from "./AvatarEditor";
import CitySetPicker from "./CitySetPicker";
import GameSettingsPanel from "./GameSettings";
import PlayerList from "./PlayerList";

interface LobbyProps {
  gameState: ClientGameState;
  username: string;
  roomId: string;
  dispatch: (action: Action) => void;
}

const Lobby = ({ gameState, username, roomId, dispatch }: LobbyProps) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const isHost = gameState.hostId === username;
  const enoughPlayers = gameState.users.length >= MIN_PLAYERS;
  const handSize = handSizeFor(gameState);
  const totalRounds = Math.max(gameState.users.length, 1) * gameState.settings.cycles;
  const { settings } = gameState;

  // Only the mechanics actually switched on get explained, so a default room
  // reads exactly as simply as it plays.
  const extras = [
    settings.collisionPenalty && t("lobby.extra.collision"),
    settings.wrongGuessPenalty > 0 &&
      t("lobby.extra.penalty", { count: settings.wrongGuessPenalty }),
    settings.doubleDown !== "off" &&
      t("lobby.extra.double", {
        scope: t(`settings.double.${settings.doubleDown}`).toLowerCase(),
        andCost: settings.wrongGuessPenalty > 0 ? t("lobby.extra.doubleAndCost") : "",
      }),
    settings.steals && t("lobby.extra.steals"),
  ].filter((entry): entry is string => typeof entry === "string");

  const copyInvite = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("roomId", roomId);
    url.searchParams.delete("username");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="order-2 space-y-4 lg:order-1">
        <Panel
          title={t("lobby.citySet.title")}
          subtitle={
            isHost
              ? t("lobby.citySet.host")
              : t("lobby.citySet.guest", { player: gameState.hostId ?? "" })
          }
          action={isHost ? <Badge tone="beacon"><Emoji symbol="👑" alt="" className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" />{t("lobby.youHost")}</Badge> : undefined}
        >
          <CitySetPicker
            citySetId={gameState.citySetId}
            citySetName={gameState.citySetName}
            poolSize={gameState.poolSize}
            isHost={isHost}
            onSelect={(setId) => dispatch({ type: "select_city_set", setId })}
            onUpload={(name, cities: City[]) =>
              dispatch({ type: "upload_city_set", name, cities })
            }
          />
        </Panel>

        <Panel
          title={t("lobby.rules.title")}
          subtitle={
            isHost
              ? t("lobby.rules.host")
              : t("lobby.rules.guest", { player: gameState.hostId ?? "" })
          }
        >
          <GameSettingsPanel gameState={gameState} isHost={isHost} dispatch={dispatch} />
        </Panel>

        <Panel title={t("lobby.how.title")}>
          <ol className="space-y-2.5 text-sm text-chart-300">
            <li className="flex gap-3">
              <span className="font-display font-bold text-beacon-500">1</span>
              <span>
                <Rich
                  k="lobby.how.1"
                  params={{
                    cards: gameState.categories.length,
                    hand: t("lobby.how.cards", { count: handSize }),
                  }}
                />
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-beacon-500">2</span>
              <span>
                <Rich k="lobby.how.2" />
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-beacon-500">3</span>
              <span>
                {t("lobby.how.3", { scores: Object.values(SCORING_VALUES).join(" · ") })}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-display font-bold text-beacon-500">4</span>
              <span>
                {t("lobby.how.4", { total: t("gameover.rounds", { count: totalRounds }) })}
              </span>
            </li>
          </ol>

          {extras.length > 0 && (
            <div className="mt-4 rounded-lg border border-beacon-500/30 bg-beacon-500/[0.06] p-3">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-beacon-300 uppercase">
                {t("lobby.alsoInPlay")}
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-chart-300">
                {extras.map((extra) => (
                  <li key={extra}>{extra}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {gameState.categories.map((category) => (
              <Badge key={category} tone="muted">
                <span className="text-beacon-500">{categoryIcons[category]}</span>
                {t(`card.${category}`)}
              </Badge>
            ))}
          </div>
        </Panel>
      </div>

      <div className="order-1 space-y-4 lg:order-2">
        <Panel
          title={t("lobby.players", { count: gameState.users.length })}
          subtitle={
            enoughPlayers
              ? undefined
              : t("lobby.waitingFor", { count: MIN_PLAYERS - gameState.users.length })
          }
        >
          <PlayerList gameState={gameState} username={username} roomId={roomId} />

          <div className="mt-4 border-t border-chart-800 pt-4">
            <AvatarEditor
              gameState={gameState}
              username={username}
              dispatch={dispatch}
            />
          </div>

          <div className="mt-4 rounded-lg border border-chart-700 bg-chart-950/60 p-3">
            <div className="text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
              {t("lobby.roomCode")}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-display text-xl font-bold tracking-wider text-beacon-400">
                {roomId}
              </span>
              <Button variant="ghost" size="sm" onClick={copyInvite}>
                {copied ? t("lobby.copied") : t("lobby.copy")}
              </Button>
            </div>
          </div>
        </Panel>

        {isHost ? (
          <Button
            size="lg"
            className="w-full"
            disabled={!enoughPlayers}
            onClick={() => dispatch({ type: "start_game" })}
          >
            {enoughPlayers
              ? t("lobby.start", { total: t("gameover.rounds", { count: totalRounds }) })
              : t("lobby.needPlayers", { count: MIN_PLAYERS })}
          </Button>
        ) : (
          <div
            className={cx(
              "rounded-lg border border-chart-700 bg-chart-850/60 px-4 py-3 text-center text-sm text-chart-400",
              enoughPlayers && "animate-pulse-ring",
            )}
          >
            {t("lobby.waitingHost", { player: gameState.hostId ?? "" })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
