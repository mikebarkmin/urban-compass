import {
  Action,
  ClientGameState,
  DoubleDownMode,
  GameSettings as Settings,
  SETTING_BOUNDS,
  TURN_CLOCK_CHOICES,
  WRONG_GUESS_CHOICES,
} from "../../game/logic";
import {
  ALL_CATEGORIES,
  BoardQuality,
  Category,
  MIN_CATEGORIES,
} from "../../game/cities";
import { useT } from "@/i18n";
import { Badge, Segmented, SettingRow, cx } from "./ui";
import { CategoryIcon } from "./Glyph";

interface GameSettingsProps {
  gameState: ClientGameState;
  isHost: boolean;
  dispatch: (action: Action) => void;
}

/** A slider plus its current value, sized so the numbers do not jump about. */
const Slider = ({
  value,
  min,
  max,
  disabled,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  suffix?: string;
}) => (
  <>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="accent-beacon-500 disabled:opacity-40"
    />
    <span className="w-14 text-right font-display text-lg font-bold text-beacon-400 tabular-nums">
      {value}
      {suffix && <span className="ml-0.5 text-xs font-medium text-chart-500">{suffix}</span>}
    </span>
  </>
);

const GameSettingsPanel = ({ gameState, isHost, dispatch }: GameSettingsProps) => {
  const t = useT();
  const { settings, poolSize, users, categories, availableCategories } = gameState;
  const locked = !isHost || gameState.phase === "playing";

  const update = (patch: Partial<Settings>) =>
    dispatch({ type: "update_settings", settings: patch });

  const maxCities = Math.min(
    SETTING_BOUNDS.citiesPerRound.max,
    Math.max(poolSize, SETTING_BOUNDS.citiesPerRound.min),
  );
  const totalRounds = Math.max(users.length, 1) * settings.cycles;

  const extras = [
    settings.collisionPenalty,
    settings.wrongGuessPenalty > 0,
    settings.doubleDown !== "off",
    settings.steals,
    settings.doubts,
    settings.powerUps,
    settings.runnerUpConsolation,
    settings.speedRound,
    settings.showCountryCodes,
  ].filter(Boolean).length;

  /** Toggling a card off is refused when it would leave too few in play. */
  const toggleCategory = (category: Category) => {
    const next = categories.includes(category)
      ? categories.filter((entry) => entry !== category)
      : [...categories, category];
    if (next.length < MIN_CATEGORIES) return;
    dispatch({ type: "set_categories", categories: next });
  };

  const everythingAvailable = availableCategories.length === ALL_CATEGORIES.length;

  return (
    <div className={cx(locked && "select-none")}>
      <SettingRow
        label={t("settings.cycles.label")}
        hint={t("settings.cycles.hint", {
          players: t("settings.playerCount", { count: users.length }),
          count: totalRounds,
        })}
      >
        <Slider
          value={settings.cycles}
          min={SETTING_BOUNDS.cycles.min}
          max={SETTING_BOUNDS.cycles.max}
          disabled={locked}
          onChange={(cycles) => update({ cycles })}
          suffix="×"
        />
      </SettingRow>

      <SettingRow label={t("settings.cities.label")} hint={t("settings.cities.hint")}>
        <Slider
          value={Math.min(settings.citiesPerRound, maxCities)}
          min={SETTING_BOUNDS.citiesPerRound.min}
          max={maxCities}
          disabled={locked}
          onChange={(citiesPerRound) => update({ citiesPerRound })}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.cards.label")}
        hint={t("settings.cards.hint", { total: categories.length })}
      >
        <Slider
          value={Math.min(settings.cardsPerPlayer, categories.length)}
          min={SETTING_BOUNDS.cardsPerPlayer.min}
          max={categories.length}
          disabled={locked}
          onChange={(cardsPerPlayer) => update({ cardsPerPlayer })}
        />
      </SettingRow>

      <SettingRow label={t("settings.clock.label")} hint={t("settings.clock.hint")}>
        <Segmented
          value={settings.turnSeconds}
          disabled={locked}
          onChange={(turnSeconds) => update({ turnSeconds })}
          options={TURN_CLOCK_CHOICES.map((seconds) => ({
            value: seconds as number,
            label: seconds === 0 ? t("settings.off") : `${seconds}s`,
          }))}
        />
      </SettingRow>

      {/* Which cards are dealt. Laid out full-width rather than in a settings
          row, because ten toggles do not fit beside a label. */}
      <div className="border-t border-chart-800 py-3">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
          {t("settings.cards2.label")}
        </div>
        <p className="mt-1 text-xs text-chart-500">
          {t("settings.cards2.hint", {
            unavailable: everythingAvailable
              ? t("settings.cards2.allAvailable")
              : t("settings.cards2.someUnavailable"),
          })}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((category) => {
            const available = availableCategories.includes(category);
            const active = categories.includes(category);
            const wouldEmpty = active && categories.length <= MIN_CATEGORIES;

            return (
              <button
                key={category}
                type="button"
                disabled={locked || !available || wouldEmpty}
                title={!available ? t("settings.cards2.someUnavailable") : undefined}
                onClick={() => toggleCategory(category)}
                className={cx(
                  "tap-target inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-beacon-500/60 bg-beacon-500/15 text-beacon-200"
                    : "border-chart-700 bg-chart-900 text-chart-500",
                  !available && "cursor-not-allowed opacity-40",
                  !locked && available && !wouldEmpty && "hover:border-chart-500",
                  (locked || wouldEmpty) && available && "cursor-not-allowed",
                )}
              >
                <CategoryIcon
                  category={category}
                  className={active ? "text-beacon-400" : "text-chart-600"}
                />
                {t(`card.${category}.short`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-chart-700 pt-4">
        <h3 className="font-display text-xs font-semibold tracking-[0.14em] text-chart-300 uppercase">
          {t("settings.extras.title")}
        </h3>
        <Badge tone={extras === 0 ? "muted" : "beacon"}>
          {extras === 0 ? t("settings.extras.none") : t("settings.extras.count", { count: extras })}
        </Badge>
      </div>
      <p className="mt-1 mb-2 text-xs text-chart-500">{t("settings.extras.lede")}</p>

      <SettingRow
        label={t("settings.collision.label")}
        hint={t(settings.collisionPenalty ? "settings.collision.on" : "settings.collision.off")}
      >
        <Segmented<boolean>
          value={settings.collisionPenalty}
          disabled={locked}
          onChange={(collisionPenalty) => update({ collisionPenalty })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.penalty.label")}
        hint={
          settings.wrongGuessPenalty === 0
            ? t("settings.penalty.off")
            : t("settings.penalty.on", { count: settings.wrongGuessPenalty })
        }
      >
        <Segmented
          value={settings.wrongGuessPenalty}
          disabled={locked}
          onChange={(wrongGuessPenalty) => update({ wrongGuessPenalty })}
          options={WRONG_GUESS_CHOICES.map((points) => ({
            value: points as number,
            label: points === 0 ? t("settings.off") : `−${points}`,
          }))}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.double.label")}
        hint={
          settings.doubleDown === "off"
            ? t("settings.double.off")
            : t("settings.double.on", { scope: t(`settings.double.${settings.doubleDown}`) })
        }
      >
        <Segmented<DoubleDownMode>
          value={settings.doubleDown}
          disabled={locked}
          onChange={(doubleDown) => update({ doubleDown })}
          options={[
            { value: "off", label: t("settings.off") },
            { value: "game", label: t("settings.double.game") },
            { value: "round", label: t("settings.double.round") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.steals.label")}
        hint={t(settings.steals ? "settings.steals.on" : "settings.steals.off")}
      >
        <Segmented<boolean>
          value={settings.steals}
          disabled={locked}
          onChange={(steals) => update({ steals })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.doubts.label")}
        hint={t(settings.doubts ? "settings.doubts.on" : "settings.doubts.off")}
      >
        <Segmented<boolean>
          value={settings.doubts}
          disabled={locked}
          onChange={(doubts) => update({ doubts })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.powerUps.label")}
        hint={t(settings.powerUps ? "settings.powerUps.on" : "settings.powerUps.off")}
      >
        <Segmented<boolean>
          value={settings.powerUps}
          disabled={locked}
          onChange={(powerUps) => update({ powerUps })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.consolation.label")}
        hint={t(
          settings.runnerUpConsolation ? "settings.consolation.on" : "settings.consolation.off",
        )}
      >
        <Segmented<boolean>
          value={settings.runnerUpConsolation}
          disabled={locked}
          onChange={(runnerUpConsolation) => update({ runnerUpConsolation })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.speedRound.label")}
        hint={t(settings.speedRound ? "settings.speedRound.on" : "settings.speedRound.off")}
      >
        <Segmented<boolean>
          value={settings.speedRound}
          disabled={locked}
          onChange={(speedRound) => update({ speedRound })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.draw.label")}
        hint={t(
          settings.boardQuality === "balanced" ? "settings.draw.balanced" : "settings.draw.random",
        )}
      >
        <Segmented<BoardQuality>
          value={settings.boardQuality}
          disabled={locked}
          onChange={(boardQuality) => update({ boardQuality })}
          options={[
            { value: "balanced", label: t("settings.balanced") },
            { value: "random", label: t("settings.random") },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.countryCodes.label")}
        hint={t(
          settings.showCountryCodes ? "settings.countryCodes.on" : "settings.countryCodes.off",
        )}
      >
        <Segmented<boolean>
          value={settings.showCountryCodes}
          disabled={locked}
          onChange={(showCountryCodes) => update({ showCountryCodes })}
          options={[
            { value: false, label: t("settings.off") },
            { value: true, label: t("settings.on") },
          ]}
        />
      </SettingRow>
    </div>
  );
};

export default GameSettingsPanel;
