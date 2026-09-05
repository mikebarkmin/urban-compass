import { Action, ClientGameState } from "../../game/logic";
import {
  AVATAR_HUES,
  AVATAR_SYMBOLS,
  AvatarConfig,
  avatarColor,
  randomAvatar,
} from "../../game/avatar";
import { symbolUrl } from "@/utils/emoji";
import { useT } from "@/i18n";
import { Avatar, Button, cx } from "./ui";

interface AvatarEditorProps {
  gameState: ClientGameState;
  username: string;
  dispatch: (action: Action) => void;
}

/**
 * Lets a player re-skin the puck everyone else sees. The choice is applied
 * live: every other client renders the new emoji the moment it is picked, so
 * the lobby and the in-game chips always agree.
 */
const AvatarEditor = ({ gameState, username, dispatch }: AvatarEditorProps) => {
  const t = useT();
  const me = gameState.users.find((u) => u.id === username);
  // A player who just connected may not be in state yet on the very first frame.
  const avatar: AvatarConfig = me?.avatar ?? { hue: AVATAR_HUES[0], symbol: AVATAR_SYMBOLS[0] };

  const set = (next: AvatarConfig) => dispatch({ type: "update_avatar", avatar: next });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={username} seed={username} size={48} avatar={avatar} />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
            {t("avatar.yours")}
          </div>
          <p className="text-xs text-chart-500">{t("avatar.hint")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => set(randomAvatar())}
        >
          {t("avatar.randomize")}
        </Button>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
          {t("avatar.color")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_HUES.map((hue) => {
            const selected = avatar.hue === hue;
            return (
              <button
                key={hue}
                type="button"
                aria-label={t("avatar.color")}
                aria-pressed={selected}
                onClick={() => set({ ...avatar, hue })}
                className={cx(
                  "h-7 w-7 rounded-full transition-transform",
                  selected
                    ? "ring-2 ring-chart-100 ring-offset-2 ring-offset-chart-900"
                    : "hover:scale-110",
                )}
                style={{ backgroundColor: avatarColor(hue) }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
          {t("avatar.symbol")}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {AVATAR_SYMBOLS.map((symbol) => {
            const selected = avatar.symbol === symbol;
            return (
              <button
                key={symbol}
                type="button"
                aria-label={symbol}
                aria-pressed={selected}
                onClick={() => set({ ...avatar, symbol })}
                className={cx(
                  "grid h-8 place-items-center rounded-md transition-colors",
                  selected
                    ? "bg-beacon-500/20 ring-1 ring-beacon-500"
                    : "hover:bg-chart-800",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={symbolUrl(symbol)}
                  alt={symbol}
                  draggable={false}
                  className="h-6 w-6"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AvatarEditor;
