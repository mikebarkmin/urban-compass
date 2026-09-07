import { useMemo, useState } from "react";
import { Category, City } from "../../game/cities";
import {
  COMMON_COUNTRIES,
  CONTINENT_KEYS,
  isNamedCountry,
  type ContinentKey,
} from "@/data/regions";
import {
  DEFAULT_POP_MIN,
  EXPEDITION_CATEGORIES,
  EXPEDITION_LIVES,
  EXPEDITION_MIN_CATEGORIES,
  EXPEDITION_POP_TIERS,
  MIN_EXPEDITION_POOL,
  type ExpeditionConfig,
  type ExpeditionRun,
  type RegionChoice,
  buildPool,
  regionToken,
} from "@/utils/expedition";
import { useLocale } from "@/i18n";
import { Button, Panel, Segmented, SettingRow, cx, inputClass } from "./ui";
import { CategoryIcon } from "./Glyph";
import { EmojiText } from "./Emoji";

type RegionKind = RegionChoice["kind"];

/** A country as this reader should see it, or its bare code when unnamed. */
export const countryLabel = (code: string, t: (key: string) => string): string =>
  isNamedCountry(code) ? t(`builder.country.${code}`) : code;

/** What a region is called on screen, in the reader's language. */
export const regionLabel = (
  region: RegionChoice,
  t: (key: string) => string,
): string => {
  switch (region.kind) {
    case "continent":
      return t(`builder.preset.${region.key}`);
    case "country":
      return countryLabel(region.code, t);
    default:
      return t("expedition.region.world");
  }
};

/** A round population floor, written the short way: 50k, 200k, 1M. */
export const popTierLabel = (value: number, t: (key: string) => string): string => {
  if (value === 0) return t("expedition.pop.any");
  if (value >= 1_000_000) return `${value / 1_000_000}M+`;
  return `${value / 1000}k+`;
};

/** A chip, the shape the builder and the settings screen already use. */
const Chip = ({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cx(
      "tap-target inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
      active
        ? "border-beacon-500/60 bg-beacon-500/15 text-beacon-200"
        : "border-chart-700 bg-chart-900 text-chart-400 hover:border-chart-500 hover:text-chart-200",
      "disabled:cursor-not-allowed disabled:opacity-40",
    )}
  >
    {children}
  </button>
);

interface ExpeditionSetupProps {
  /** The gazetteer, once it has arrived. */
  cities: City[] | null;
  loading: boolean;
  loadedMb: number;
  loadError: boolean;
  onRetry: () => void;
  initial?: ExpeditionConfig | null;
  /** Best round reached per region token, so a record shows next to its region. */
  bestByRegion: Record<string, number>;
  /** A saved run to offer, or null when there is nothing to pick up. */
  resumable?: ExpeditionRun | null;
  onResume: () => void;
  onDiscard: () => void;
  onStart: (config: ExpeditionConfig) => void;
}

/**
 * Where an expedition is planned: what to be tested on, and where in the world
 * to be tested on it. Both halves are the point of the mode — "only east and
 * west, in Japan" is a drill the daily cannot give you.
 */
const ExpeditionSetup = ({
  cities,
  loading,
  loadedMb,
  loadError,
  onRetry,
  initial,
  bestByRegion,
  resumable,
  onResume,
  onDiscard,
  onStart,
}: ExpeditionSetupProps) => {
  const { t } = useLocale();

  const [kind, setKind] = useState<RegionKind>(initial?.region.kind ?? "world");
  const [continent, setContinent] = useState<ContinentKey>(
    initial?.region.kind === "continent" ? initial.region.key : "europe",
  );
  const [country, setCountry] = useState(
    initial?.region.kind === "country" ? initial.region.code : "DE",
  );
  const [countryText, setCountryText] = useState("");
  const [categories, setCategories] = useState<Category[]>(
    initial?.categories ?? EXPEDITION_CATEGORIES.slice(0, 6),
  );
  const [popMin, setPopMin] = useState<number>(initial?.popMin ?? DEFAULT_POP_MIN);

  const region: RegionChoice =
    kind === "continent"
      ? { kind: "continent", key: continent }
      : kind === "country"
        ? { kind: "country", code: country }
        : { kind: "world" };

  const config: ExpeditionConfig = { region, categories, popMin };

  // The pool the current settings would play, so the size and the altitude
  // cards' cost are visible before the first board rather than after it.
  const pool = useMemo(
    () => (cities ? buildPool(cities, config) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, kind, continent, country, categories, popMin],
  );

  const tooThin = pool !== null && pool.length < MIN_EXPEDITION_POOL;
  const ready = !!pool && !tooThin;
  const best = bestByRegion[regionToken(region)] ?? 0;

  const toggleCategory = (category: Category) => {
    setCategories((current) => {
      if (!current.includes(category)) {
        // Keep the canonical card order, so the hand always reads the same way.
        return EXPEDITION_CATEGORIES.filter(
          (entry) => entry === category || current.includes(entry),
        );
      }
      if (current.length <= EXPEDITION_MIN_CATEGORIES) return current;
      return current.filter((entry) => entry !== category);
    });
  };

  const addCountryText = () => {
    const code = countryText.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return;
    setCountry(code);
    setKind("country");
    setCountryText("");
  };

  return (
    <div className="grid gap-4 py-2 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="animate-rise">
          <h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {t("expedition.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-chart-300">{t("expedition.lede")}</p>
        </div>

        {resumable && (
          <Panel
            className="animate-rise border-beacon-500/40"
            title={t("expedition.resume.title")}
          >
            <p className="text-xs text-chart-400">
              {t("expedition.resume.body", {
                round: resumable.round,
                region: regionLabel(resumable.config.region, t),
                lives: resumable.lives,
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={onResume}>
                {t("expedition.resume.continue")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
                {t("expedition.resume.discard")}
              </Button>
            </div>
          </Panel>
        )}

        <Panel title={t("expedition.setup.title")}>
          <SettingRow label={t("expedition.setup.region")} hint={t("expedition.setup.regionHint")}>
            <Segmented<RegionKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: "world", label: t("expedition.region.world") },
                { value: "continent", label: t("expedition.region.continent") },
                { value: "country", label: t("expedition.region.country") },
              ]}
            />
          </SettingRow>

          {kind === "continent" && (
            <div className="flex flex-wrap gap-1.5 pb-3">
              {CONTINENT_KEYS.map((key) => (
                <Chip
                  key={key}
                  active={continent === key}
                  onClick={() => setContinent(key)}
                >
                  {t(`builder.preset.${key}`)}
                </Chip>
              ))}
            </div>
          )}

          {kind === "country" && (
            <div className="space-y-3 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {COMMON_COUNTRIES.map((code) => (
                  <Chip key={code} active={country === code} onClick={() => setCountry(code)}>
                    {t(`builder.country.${code}`)}
                  </Chip>
                ))}
                {!isNamedCountry(country) && (
                  <Chip active onClick={() => undefined}>
                    {country}
                  </Chip>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} max-w-32 font-display tracking-widest uppercase`}
                  value={countryText}
                  maxLength={2}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("expedition.setup.countryPlaceholder")}
                  onChange={(event) => setCountryText(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCountryText();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addCountryText}>
                  {t("builder.country.add")}
                </Button>
                <span className="self-center text-xs text-chart-500">
                  {t("expedition.setup.countryHint")}
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-chart-800 py-3">
            <div className="text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
              {t("expedition.setup.cards")}
            </div>
            <p className="mt-1 mb-2.5 text-xs text-chart-500">
              {t("expedition.setup.cardsHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
            {EXPEDITION_CATEGORIES.map((category) => {
              const active = categories.includes(category);
              return (
                <Chip
                  key={category}
                  active={active}
                  disabled={active && categories.length <= EXPEDITION_MIN_CATEGORIES}
                  onClick={() => toggleCategory(category)}
                >
                  <CategoryIcon
                    category={category}
                    className={active ? "text-beacon-400" : "text-chart-600"}
                  />
                  {t(`card.${category}.short`)}
                </Chip>
              );
            })}
            </div>
          </div>

          <SettingRow
            label={t("expedition.setup.population")}
            hint={t("expedition.setup.populationHint")}
          >
            <Segmented<number>
              value={popMin}
              onChange={setPopMin}
              options={EXPEDITION_POP_TIERS.map((tier) => ({
                value: tier,
                label: popTierLabel(tier, t),
              }))}
            />
          </SettingRow>

          <div className="border-t border-chart-800 pt-3 text-xs">
            {loadError ? (
              <span className="flex flex-wrap items-center gap-2 text-alert-500">
                {t("expedition.loadError")}
                <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                  {t("expedition.retry")}
                </Button>
              </span>
            ) : loading || !pool ? (
              <span className="text-chart-400">
                {t("expedition.loading", { mb: loadedMb.toFixed(1) })}
              </span>
            ) : tooThin ? (
              <span className="text-alert-500">{t("expedition.pool.thin")}</span>
            ) : (
              <span className="text-chart-400">
                {t("expedition.pool", { count: pool.length })}
                {best > 0 && (
                  <span className="ml-2 text-beacon-400">
                    {t("expedition.setup.regionBest", { round: best })}
                  </span>
                )}
              </span>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-4 w-full"
            disabled={!ready}
            onClick={() => onStart(config)}
          >
            {t("expedition.start")}
          </Button>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title={t("expedition.rules.title")}>
          <ul className="space-y-3 text-xs text-chart-400">
            <li>{t("expedition.rules.lives", { count: EXPEDITION_LIVES })}</li>
            <li>{t("expedition.rules.perfect")}</li>
            <li>{t("expedition.rules.ramp")}</li>
            <li>
              <EmojiText
                text={t("expedition.rules.share")}
                emojiClassName="inline h-3.5 w-3.5 align-[-2px]"
              />
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
};

export default ExpeditionSetup;
