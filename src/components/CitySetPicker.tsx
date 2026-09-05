import { DragEvent, useEffect, useRef, useState } from "react";
import {
  CITY_SETS,
  CUSTOM_CITY_SET_ID,
  DIFFICULTY_ORDER,
  MIN_POOL_SIZE,
  citySetCategories,
} from "../../game/citySets";
import { City, categoryIcons, cityName, formatCoordinate, formatPopulation } from "../../game/cities";
import {
  KmzParseError,
  ParsedCitySet,
  flipCoordinateFormat,
  parseCityFile,
  swapCoordinates,
} from "@/utils/kmz";
import { exportKmz } from "@/utils/kmzExport";
import {
  deleteSavedSet,
  loadSavedSets,
  saveSet,
  type SavedCitySet,
} from "@/data/savedSets";
import { useLocale } from "@/i18n";
import { Emoji } from "./Emoji";
import { Badge, Button, cx } from "./ui";
import MiniMap from "./MiniMap";
import CitySetBuilder from "./CitySetBuilder";

interface CitySetPickerProps {
  citySetId: string;
  citySetName: string;
  poolSize: number;
  isHost: boolean;
  disabled?: boolean;
  onSelect: (setId: string) => void;
  onUpload: (name: string, cities: City[]) => void;
}

const CitySetPicker = ({
  citySetId,
  citySetName,
  poolSize,
  isHost,
  disabled,
  onSelect,
  onUpload,
}: CitySetPickerProps) => {
  const { locale, t } = useLocale();
  const [parsed, setParsed] = useState<ParsedCitySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [savedSets, setSavedSets] = useState<SavedCitySet[]>([]);
  const [uploadSaved, setUploadSaved] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    cities: City[];
  } | null>(null);

  const locked = !isHost || disabled;

  useEffect(() => {
    setSavedSets(loadSavedSets());
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await parseCityFile(file);
      if (result.cities.length < MIN_POOL_SIZE) {
        setParsed(null);
        setError(
          t("picker.error.tooFew", { found: result.cities.length, needed: MIN_POOL_SIZE }),
        );
      } else {
        setParsed(result);
        setUploadSaved(false);
      }
    } catch (cause) {
      setParsed(null);
      setError(cause instanceof KmzParseError ? cause.message : t("picker.error.unreadable"));
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (locked) return;
    void handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-4">
      {DIFFICULTY_ORDER.map((difficulty) => {
        const sets = CITY_SETS.filter((set) => set.difficulty === difficulty);
        if (sets.length === 0) return null;

        return (
          <div key={difficulty}>
            <div className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-chart-500 uppercase">
              {t(`difficulty.${difficulty}`)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sets.map((set) => {
                const active = citySetId === set.id;
                // Which cards a set can offer is worth seeing before you pick
                // it — only some carry altitude, fewer still carry area.
                const cards = citySetCategories(set);

                return (
                  <button
                    key={set.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onSelect(set.id)}
                    className={cx(
                      "group rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-beacon-500 bg-beacon-500/10"
                        : "border-chart-700 bg-chart-850/60 hover:border-chart-500 hover:bg-chart-800",
                      locked && "cursor-not-allowed opacity-60 hover:border-chart-700",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Emoji symbol={set.icon} alt="" className="h-6 w-6" />
                      {active && <Badge tone="beacon">{t("picker.selected")}</Badge>}
                    </div>
                    <div className="mt-2 font-display text-sm font-semibold text-chart-100">
                      {t(`set.${set.id}.name`)}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-chart-400">
                      {t(`set.${set.id}.desc`)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-chart-500">
                        {t("picker.cities", { count: set.cities.length })}
                      </span>
                      <span className="font-display text-xs tracking-wider text-chart-600">
                        {cards.map((category) => categoryIcons[category]).join("")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <CitySetBuilder
        locked={locked}
        inUse={citySetId === CUSTOM_CITY_SET_ID}
        onUpload={onUpload}
        onSaved={() => setSavedSets(loadSavedSets())}
        editTarget={editTarget}
        onEditComplete={() => {
          setEditTarget(null);
          setSavedSets(loadSavedSets());
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cx(
          "rounded-xl border border-dashed p-4 transition-colors",
          dragging ? "border-beacon-500 bg-beacon-500/10" : "border-chart-600 bg-chart-850/40",
          locked && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Emoji symbol="📍" alt="" className="h-5 w-5" />
              <span className="font-display text-sm font-semibold text-chart-100">
                {t("picker.upload.title")}
              </span>
            </div>
            <p className="mt-1 text-xs text-chart-400">{t("home.feature.upload")}</p>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={locked || busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? t("picker.upload.reading") : t("picker.upload.choose")}
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
            {error}
          </p>
        )}

        {parsed && (
          <div className="mt-4 animate-rise space-y-3 rounded-xl border border-chart-700 bg-chart-900/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display text-sm font-semibold text-chart-100">
                  {parsed.name}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="signal">
                    {t("picker.cities", { count: parsed.cities.length })}
                  </Badge>
                  <Badge tone="muted">{t(`picker.format.${parsed.coordinateFormat}`)}</Badge>
                  {parsed.skipped.length > 0 && (
                    <Badge tone="muted">
                      {t("picker.skipped", { count: parsed.skipped.length })}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {parsed.coordinateFormat !== "point" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setParsed(flipCoordinateFormat(parsed))}
                      title={t("picker.rereadTitle")}
                    >
                      {t("picker.rereadAs", {
                        format: t(
                          parsed.coordinateFormat === "decimal"
                            ? "picker.degmin"
                            : "picker.decimal",
                        ),
                      })}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setParsed(swapCoordinates(parsed))}
                      title={t("picker.swapTitle")}
                    >
                      {t("picker.swap")}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void exportKmz(parsed.name, parsed.cities)}
                >
                  {t("saved.export")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploadSaved}
                  onClick={() => {
                    saveSet(parsed.name, parsed.cities);
                    setUploadSaved(true);
                    setSavedSets(loadSavedSets());
                  }}
                >
                  {uploadSaved ? t("saved.saved") : t("saved.save")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onUpload(parsed.name, parsed.cities);
                    setParsed(null);
                  }}
                >
                  {t("picker.use")}
                </Button>
              </div>
            </div>

            <MiniMap cities={parsed.cities} labels={false} height={180} />

            <details className="text-xs text-chart-400">
              <summary className="cursor-pointer text-chart-300 hover:text-chart-100">
                {t("picker.check")}
              </summary>
              <ul className="thin-scroll mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                {parsed.cities.slice(0, 40).map((city) => (
                  <li
                    key={city.id}
                    className="flex justify-between gap-3 border-b border-chart-800 py-1"
                  >
                    <span className="text-chart-200">
                      {cityName(city, locale)}
                      {city.country && (
                        <span className="ml-1.5 text-chart-500">{city.country}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-chart-500">
                      {formatCoordinate(city.latitude, "lat")} ·{" "}
                      {formatCoordinate(city.longitude, "lon")} ·{" "}
                      {formatPopulation(city.population)}
                    </span>
                  </li>
                ))}
              </ul>
              {parsed.skipped.length > 0 && (
                <p className="mt-2 text-chart-500">
                  {t("picker.skippedList", {
                    names: parsed.skipped.slice(0, 8).map((entry) => entry.name).join(", "),
                    more:
                      parsed.skipped.length > 8
                        ? t("picker.andMore", { count: parsed.skipped.length - 8 })
                        : "",
                  })}
                </p>
              )}
            </details>
          </div>
        )}
      </div>

      {savedSets.length > 0 && (
        <div className="rounded-xl border border-chart-700 bg-chart-850/40 p-4">
          <div className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-chart-500 uppercase">
            {t("saved.title")}
          </div>
          <ul className="space-y-2">
            {savedSets.map((set) => {
              const isActive =
                citySetId === CUSTOM_CITY_SET_ID && set.name === citySetName;
              return (
              <li key={set.id} className="space-y-2">
                <div
                  className={cx(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                    isActive
                      ? "border-beacon-500/60 bg-beacon-500/10"
                      : "border-chart-800 bg-chart-900/50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-semibold text-chart-100">
                        {set.name}
                      </span>
                      {isActive && <Badge tone="beacon">{t("picker.upload.inUse")}</Badge>}
                    </div>
                    <div className="text-[11px] text-chart-500">
                      {t("picker.cities", { count: set.cities.length })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void exportKmz(set.name, set.cities)}
                    >
                      {t("saved.export")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() =>
                        setEditTarget({
                          id: set.id,
                          name: set.name,
                          cities: set.cities,
                        })
                      }
                    >
                      {t("saved.load")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSavedSets(deleteSavedSet(set.id))}
                    >
                      {t("saved.delete")}
                    </Button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-chart-700 bg-chart-900/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Emoji symbol="🎯" alt="" className="h-4 w-4" />
          <span className="text-xs text-chart-300">
            {t("set.playing", {
              set:
                citySetId === CUSTOM_CITY_SET_ID
                  ? citySetName
                  : t(`set.${citySetId}.name`),
              count: poolSize,
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CitySetPicker;
