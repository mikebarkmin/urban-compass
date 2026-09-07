import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  City,
  cityName,
  formatCoordinate,
  formatPopulation,
} from "../../game/cities";
import { MAX_CUSTOM_CITIES, MIN_POOL_SIZE } from "../../game/citySets";
import { loadCities } from "@/data/citiesLoader";
import { saveSet, updateSavedSet } from "@/data/savedSets";
import { exportKmz } from "@/utils/kmzExport";
import {
  KmzParseError,
  ParsedCitySet,
  flipCoordinateFormat,
  parseCityFile,
  swapCoordinates,
} from "@/utils/kmz";
import { filterCities, matchingCities, type FilterParams } from "@/data/cityFilter";
import {
  COMMON_COUNTRIES,
  CONTINENT_BOUNDS,
  CONTINENT_KEYS,
  type ContinentKey,
} from "@/data/regions";
import { useLocale } from "@/i18n";
import { Emoji } from "./Emoji";
import { Badge, Button, Segmented, cx, inputClass } from "./ui";
import MiniMap from "./MiniMap";
import SkippedPlacemarks from "./SkippedPlacemarks";

interface CitySetBuilderProps {
  locked?: boolean;
  inUse?: boolean;
  /** Hand the finished set to a room. Absent outside a lobby, where there is
   * no room to hand it to and the set is only saved or exported. */
  onUpload?: (name: string, cities: City[]) => void;
  /** Called after a set is saved, so the picker can refresh its saved list. */
  onSaved?: () => void;
  /** A saved set to edit, or null when building from scratch. When set, the
   * builder opens in edit mode with the set's name and cities pre-filled. */
  editTarget?: { id: string; name: string; cities: City[] } | null;
  /** Called when the edit is done (saved, used, or cancelled). */
  onEditComplete?: () => void;
}

/**
 * Where a new set comes from. The two paths are different enough — a 4 MB
 * dataset to filter down, or a file the host already has — that the panel asks
 * which one up front instead of hiding the upload inside the dataset builder.
 */
type BuildSource = "file" | "dataset";

const CitySetBuilder = ({
  locked,
  inUse,
  onUpload,
  onSaved,
  editTarget,
  onEditComplete,
}: CitySetBuilderProps) => {
  const { locale, t } = useLocale();
  const [source, setSource] = useState<BuildSource>("dataset");

  const [cities, setCities] = useState<City[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Megabytes pulled so far, so a slow connection does not look like a hang.
  const [loadedMb, setLoadedMb] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const [latMin, setLatMin] = useState(-90);
  const [latMax, setLatMax] = useState(90);
  const [lonMin, setLonMin] = useState(-180);
  const [lonMax, setLonMax] = useState(180);
  const [popMin, setPopMin] = useState(5000);
  const [popMax, setPopMax] = useState<number | "">("");

  const [countries, setCountries] = useState<string[]>([]);
  const [countryText, setCountryText] = useState("");
  const [name, setName] = useState("");

  const [handpick, setHandpick] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Upload state — the collapsed builder offers a file upload as an alternative
  // to building from the geonames dataset.
  const [parsed, setParsed] = useState<ParsedCitySet | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadSaved, setUploadSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // When editing a saved set, the working copy of its cities. Null when the
  // builder is in build-from-scratch mode.
  const [editCities, setEditCities] = useState<City[] | null>(null);

  // Entering edit mode: seed the working copy and load the dataset (for the
  // search-to-add). Leaving: reset and fall back to the default source.
  useEffect(() => {
    if (editTarget) {
      setEditCities([...editTarget.cities]);
      setName(editTarget.name);
      if (!cities && !loading) {
        setLoading(true);
        setLoadError(false);
        void loadCities(setLoadedMb).then((loaded) => {
          setCities(loaded);
          if (loaded.length === 0) setLoadError(true);
          else {
            const max = loaded.reduce((m, c) => (c.population > m ? c.population : m), 0);
            setPopMax(max);
          }
          setLoading(false);
        });
      }
    } else {
      setEditCities(null);
      setSource("dataset");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget]);

  const isEditing = editCities !== null;

  // The existing "loading" string plus a running byte count — no new
  // translation needed, and it is the same wording in both languages.
  const loadingLabel = loadedMb > 0.05
    ? `${t("builder.loading")} ${loadedMb.toFixed(1)} MB`
    : t("builder.loading");

  const ensureLoaded = () => {
    setSource("dataset");
    if (loading || cities) return;
    setLoading(true);
    setLoadError(false);
    void loadCities(setLoadedMb).then((loaded) => {
      setCities(loaded);
      if (loaded.length === 0) {
        setLoadError(true);
      } else {
        const max = loaded.reduce((m, c) => (c.population > m ? c.population : m), 0);
        setPopMax(max);
      }
      setLoading(false);
    });
  };

  // The dataset source is the default, so the dataset is fetched as the panel
  // mounts rather than on a click. Skipped while locked — a player who cannot
  // build a set has no use for 4 MB of cities — and while editing, where the
  // effect above already loads it.
  useEffect(() => {
    if (!locked && !editTarget) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const params: FilterParams = useMemo(
    () => ({
      latMin,
      latMax,
      lonMin,
      lonMax,
      popMin,
      popMax: popMax === "" ? undefined : popMax,
      countries,
    }),
    [latMin, latMax, lonMin, lonMax, popMin, popMax, countries],
  );

  const allMatches = useMemo(
    () => (cities ? matchingCities(cities, params) : []),
    [cities, params],
  );
  const filtered = useMemo(
    () => (cities ? filterCities(cities, params) : []),
    [cities, params],
  );

  const tooFew = filtered.length < MIN_POOL_SIZE;
  const truncated = allMatches.length > MAX_CUSTOM_CITIES;
  const resolvedName =
    name.trim() ||
    t("builder.autoName", { count: allMatches.length.toLocaleString("en-US") });

  // In handpick mode the host picks individual cities from the filtered pool;
  // otherwise the whole filtered pool is used.
  const handpicked = useMemo(
    () => (handpick ? filtered.filter((c) => selected.has(c.id)) : filtered),
    [handpick, filtered, selected],
  );
  const useTooFew = handpick ? handpicked.length < MIN_POOL_SIZE : tooFew;

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const searchResults = useMemo(() => {
    if (!handpick || !search.trim()) return filtered;
    const term = search.trim().toLowerCase();
    return filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.nameDe?.toLowerCase().includes(term) ?? false) ||
        (c.country?.toLowerCase().includes(term) ?? false),
    );
  }, [handpick, search, filtered]);

  // Drop the "Saved" confirmation once the pool changes, so it does not
  // mislead the host into thinking the new selection is already stored.
  useEffect(() => {
    setSaved(false);
  }, [params]);

  // --- Edit mode helpers ---

  const editSearchResults = useMemo(() => {
    if (!cities || !search.trim() || !editCities) return [];
    const term = search.trim().toLowerCase();
    const existingIds = new Set(editCities.map((c) => c.id));
    return cities
      .filter((c) => !existingIds.has(c.id))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.nameDe?.toLowerCase().includes(term) ?? false) ||
          (c.country?.toLowerCase().includes(term) ?? false),
      )
      .slice(0, 50);
  }, [cities, search, editCities]);

  const addEditCity = (city: City) => {
    setEditCities((current) =>
      current && !current.some((c) => c.id === city.id) ? [...current, city] : current,
    );
    setSearch("");
  };

  const removeEditCity = (cityId: string) => {
    setEditCities((current) => (current ? current.filter((c) => c.id !== cityId) : current));
  };

  const editTooFew = (editCities?.length ?? 0) < MIN_POOL_SIZE;

  const applyContinent = (key: ContinentKey) => {
    const bounds = CONTINENT_BOUNDS[key];
    setLatMin(bounds.latMin);
    setLatMax(bounds.latMax);
    setLonMin(bounds.lonMin);
    setLonMax(bounds.lonMax);
  };

  const applyCountryShortcut = (code: string) => {
    setCountries((current) =>
      current.includes(code) ? current : [...current, code],
    );
  };

  const toggleCountry = (code: string) => {
    setCountries((current) =>
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    );
  };

  const addCountryText = () => {
    const codes = countryText
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c));
    if (codes.length === 0) return;
    setCountries((current) => {
      const merged = [...current];
      for (const code of codes) if (!merged.includes(code)) merged.push(code);
      return merged;
    });
    setCountryText("");
  };

  const extraCountries = countries.filter((c) => !COMMON_COUNTRIES.includes(c));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const result = await parseCityFile(file);
      setParsed(result);
      setUploadSaved(false);
    } catch (cause) {
      setParsed(null);
      setUploadError(cause instanceof KmzParseError ? cause.message : t("picker.error.unreadable"));
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  // An upload can parse and still not hold a playable set — often because the
  // skipped placemarks are the missing ones, which the repair form can recover.
  const uploadTooFew = !!parsed && parsed.cities.length < MIN_POOL_SIZE;

  return (
    <div className={cx(
      "rounded-xl border p-4 transition-colors",
      inUse && !isEditing ? "border-beacon-500/60 bg-beacon-500/5" : "border-chart-700 bg-chart-850/40",
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Emoji symbol={isEditing ? "✏️" : "🧩"} alt="" className="h-5 w-5" />
            <span className="font-display text-sm font-semibold text-chart-100">
              {isEditing ? t("editor.title") : t("builder.title")}
            </span>
            {inUse && !isEditing && <Badge tone="beacon">{t("picker.upload.inUse")}</Badge>}
          </div>
          <p className="mt-1 text-xs text-chart-400">
            {isEditing
              ? editTarget?.name ?? ""
              : loading
                ? loadingLabel
                : t(source === "dataset" ? "builder.subtitle" : "builder.subtitle.file")}
          </p>
        </div>
        {isEditing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (editTarget) onEditComplete?.();
              else {
                setEditCities(null);
                setSource("file");
              }
            }}
          >
            {t("editor.cancel")}
          </Button>
        ) : (
          <Segmented
            value={source}
            disabled={locked}
            options={[
              { value: "file" as BuildSource, label: t("builder.source.file") },
              { value: "dataset" as BuildSource, label: t("builder.source.dataset") },
            ]}
            onChange={(next) => (next === "dataset" ? ensureLoaded() : setSource("file"))}
          />
        )}
      </div>

      {!isEditing && source === "file" && (
        <div className="mt-4 space-y-3">
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
                <p className="mt-1 text-xs text-chart-400">
                  {t("home.feature.upload")}{" "}
                  <Link
                    href="/help"
                    className="text-chart-300 underline underline-offset-2 hover:text-chart-100"
                  >
                    {t("picker.help")}
                  </Link>
                </p>
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
                disabled={locked || uploadBusy}
                onClick={() => fileInput.current?.click()}
              >
                {uploadBusy ? t("picker.upload.reading") : t("picker.upload.choose")}
              </Button>
            </div>

            {uploadError && (
              <p className="mt-3 rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
                {uploadError}
              </p>
            )}
          </div>

          {parsed && (
            <div className="animate-rise space-y-3 rounded-xl border border-chart-700 bg-chart-900/70 p-3">
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
                    disabled={uploadTooFew}
                    onClick={() => void exportKmz(parsed.name, parsed.cities)}
                  >
                    {t("saved.export")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={uploadSaved || uploadTooFew}
                    onClick={() => {
                      saveSet(parsed.name, parsed.cities);
                      setUploadSaved(true);
                      onSaved?.();
                    }}
                  >
                    {uploadSaved ? t("saved.saved") : t("saved.save")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={uploadTooFew}
                    onClick={() => {
                      setEditCities([...parsed.cities]);
                      setName(parsed.name);
                      setParsed(null);
                      setUploadError(null);
                      if (!cities && !loading) {
                        setLoading(true);
                        setLoadError(false);
                        void loadCities(setLoadedMb).then((loaded) => {
                          setCities(loaded);
                          if (loaded.length === 0) setLoadError(true);
                          else {
                            const max = loaded.reduce((m, c) => (c.population > m ? c.population : m), 0);
                            setPopMax(max);
                          }
                          setLoading(false);
                        });
                      }
                    }}
                  >
                    {t("editor.title")}
                  </Button>
                </div>
              </div>

              {uploadTooFew && (
                <p className="rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
                  {t("picker.error.tooFew", {
                    found: parsed.cities.length,
                    needed: MIN_POOL_SIZE,
                  })}
                </p>
              )}

              {parsed.skipped.length > 0 && (
                <SkippedPlacemarks
                  parsed={parsed}
                  disabled={locked}
                  onRepair={(repaired) => {
                    setParsed(repaired);
                    setUploadSaved(false);
                  }}
                />
              )}

              {parsed.cities.length > 0 && (
                <MiniMap cities={parsed.cities} labels={false} height={180} />
              )}

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
              </details>
            </div>
          )}
        </div>
      )}

      {(isEditing || source === "dataset") && (
        <div className="mt-4 space-y-4">
          {loadError && (
            <p className="rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
              {t("builder.loadError")}
            </p>
          )}

          {isEditing && editCities ? (
            <>
              {/* Name */}
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
                  {t("editor.name")}
                </span>
                <input
                  type="text"
                  value={name}
                  disabled={locked}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                />
              </label>

              {/* Search to add from the geonames dataset */}
              <div>
                <input
                  type="text"
                  value={search}
                  disabled={locked}
                  placeholder={loading ? loadingLabel : t("editor.search")}
                  onChange={(event) => setSearch(event.target.value)}
                  className={cx(inputClass, "py-1.5 text-xs")}
                />
                {editSearchResults.length > 0 && (
                  <ul className="thin-scroll mt-2 max-h-40 space-y-0.5 overflow-y-auto pr-2 text-xs">
                    {editSearchResults.map((city) => (
                      <li
                        key={city.id}
                        className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-chart-800/60"
                      >
                        <span className="text-chart-200">
                          {cityName(city, locale)}
                          {city.country && (
                            <span className="ml-1.5 text-chart-500">{city.country}</span>
                          )}
                          <span className="ml-1.5 font-mono text-[11px] text-chart-600">
                            {formatPopulation(city.population)}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={locked}
                          onClick={() => addEditCity(city)}
                        >
                          {t("editor.add")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* City list with remove buttons */}
              {editCities.length === 0 ? (
                <p className="text-xs text-chart-500">{t("editor.empty")}</p>
              ) : (
                <ul className="thin-scroll max-h-56 space-y-0.5 overflow-y-auto pr-2 text-xs">
                  {editCities.map((city) => (
                    <li
                      key={city.id}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-chart-800/60"
                    >
                      <span className="text-chart-200">
                        {cityName(city, locale)}
                        {city.country && (
                          <span className="ml-1.5 text-chart-500">{city.country}</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => removeEditCity(city.id)}
                      >
                        {t("editor.remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={editTooFew ? "muted" : "signal"}>
                    {t("picker.cities", { count: editCities.length })}
                  </Badge>
                  {editTooFew && (
                    <Badge tone="muted">
                      {t("handpick.tooFew", { needed: MIN_POOL_SIZE })}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked || editTooFew}
                    onClick={() =>
                      void exportKmz(name || editTarget?.name || "Custom set", editCities)
                    }
                  >
                    {t("saved.export")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked || editTooFew}
                    onClick={() => {
                      if (editTarget) {
                        updateSavedSet(editTarget.id, name, editCities);
                        onSaved?.();
                        onEditComplete?.();
                      } else {
                        saveSet(name || "Custom set", editCities ?? []);
                        onSaved?.();
                        setEditCities(null);
                        setSource("file");
                      }
                    }}
                  >
                    {t("editor.save")}
                  </Button>
                  {onUpload && (
                    <Button
                      size="sm"
                      disabled={locked || editTooFew}
                      onClick={() => {
                        onUpload(name || editTarget?.name || "Custom set", editCities);
                        onEditComplete?.();
                      }}
                    >
                      {t("builder.use")}
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {loading && (
                <p className="text-xs text-chart-400">{loadingLabel}</p>
              )}

              {cities && !loading && (
            <>
              {/* Continent + country presets */}
              <div className="flex flex-wrap gap-1.5">
                {CONTINENT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={locked}
                    onClick={() => applyContinent(key)}
                    className="rounded-full border border-chart-600 bg-chart-800 px-2.5 py-1 text-xs text-chart-200 transition-colors hover:border-chart-500 hover:bg-chart-700 disabled:opacity-40"
                  >
                    {t(`builder.preset.${key}`)}
                  </button>
                ))}
                <span className="mx-1 self-center text-chart-600">·</span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => applyCountryShortcut("DE")}
                  className="rounded-full border border-chart-600 bg-chart-800 px-2.5 py-1 text-xs text-chart-200 transition-colors hover:border-chart-500 hover:bg-chart-700 disabled:opacity-40"
                >
                  {t("builder.preset.germany")}
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => applyCountryShortcut("US")}
                  className="rounded-full border border-chart-600 bg-chart-800 px-2.5 py-1 text-xs text-chart-200 transition-colors hover:border-chart-500 hover:bg-chart-700 disabled:opacity-40"
                >
                  {t("builder.preset.usa")}
                </button>
              </div>

              {/* Range inputs */}
              <div className="grid gap-3 sm:grid-cols-3">
                <RangeField
                  label={t("builder.field.latitude")}
                  min={latMin}
                  max={latMax}
                  minBound={-90}
                  maxBound={90}
                  disabled={locked}
                  onMinChange={setLatMin}
                  onMaxChange={setLatMax}
                />
                <RangeField
                  label={t("builder.field.longitude")}
                  min={lonMin}
                  max={lonMax}
                  minBound={-180}
                  maxBound={180}
                  disabled={locked}
                  onMinChange={setLonMin}
                  onMaxChange={setLonMax}
                />
                <RangeField
                  label={t("builder.field.population")}
                  min={popMin}
                  max={popMax === "" ? 5_000_000 : popMax}
                  minBound={0}
                  maxBound={50_000_000}
                  disabled={locked}
                  onMinChange={setPopMin}
                  onMaxChange={(v) => setPopMax(v)}
                />
              </div>

              {/* Country filter */}
              <div>
                <div className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
                  {t("builder.country")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_COUNTRIES.map((code) => {
                    const active = countries.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={locked}
                        onClick={() => toggleCountry(code)}
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                          active
                            ? "border-beacon-500 bg-beacon-500/15 text-beacon-300"
                            : "border-chart-600 bg-chart-800 text-chart-200 hover:border-chart-500 hover:bg-chart-700",
                        )}
                      >
                        {t(`builder.country.${code}`)}
                      </button>
                    );
                  })}
                </div>

                {extraCountries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {extraCountries.map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={locked}
                        onClick={() => toggleCountry(code)}
                        className="rounded-full border border-beacon-500 bg-beacon-500/15 px-2.5 py-1 text-xs text-beacon-300"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={countryText}
                    disabled={locked}
                    placeholder={t("builder.countryHint")}
                    onChange={(event) => setCountryText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCountryText();
                      }
                    }}
                    className={cx(inputClass, "py-1.5 text-xs")}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={locked}
                    onClick={addCountryText}
                  >
                    {t("builder.country.add")}
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-3 rounded-xl border border-chart-700 bg-chart-900/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={useTooFew ? "muted" : "signal"}>
                      {t("builder.count", { count: handpicked.length })}
                    </Badge>
                    {truncated && (
                      <Badge tone="muted">
                        {t("builder.truncated", {
                          shown: filtered.length,
                          count: allMatches.length,
                        })}
                      </Badge>
                    )}
                    {handpick && selected.size > 0 && (
                      <Badge tone="beacon">
                        {t("handpick.selected", { count: selected.size })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked || useTooFew}
                      onClick={() => {
                        setSaved(false);
                        void exportKmz(resolvedName, handpicked).finally(() =>
                          setExporting(false),
                        );
                        setExporting(true);
                      }}
                    >
                      {t("saved.export")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked || useTooFew || saved}
                      onClick={() => {
                        saveSet(resolvedName, handpicked);
                        setSaved(true);
                        onSaved?.();
                      }}
                    >
                      {saved ? t("saved.saved") : t("saved.save")}
                    </Button>
                    {onUpload && (
                      <Button
                        size="sm"
                        disabled={locked || useTooFew || exporting}
                        onClick={() => onUpload(resolvedName, handpicked)}
                      >
                        {t("builder.use")}
                      </Button>
                    )}
                  </div>
                </div>

                {useTooFew && (
                  <p className="rounded-lg border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-xs text-alert-500">
                    {handpick
                      ? t("handpick.tooFew", { needed: MIN_POOL_SIZE })
                      : t("builder.tooFew", {
                          found: allMatches.length,
                          needed: MIN_POOL_SIZE,
                        })}
                  </p>
                )}

                {/* Handpick toggle */}
                <label className="flex items-center gap-2 text-xs text-chart-300">
                  <input
                    type="checkbox"
                    checked={handpick}
                    disabled={locked}
                    onChange={(event) => {
                      setHandpick(event.target.checked);
                      if (!event.target.checked) {
                        setSelected(new Set());
                        setSearch("");
                      }
                    }}
                    className="accent-beacon-500"
                  />
                  {t("handpick.toggle")}
                </label>

                {handpick && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={search}
                        disabled={locked}
                        placeholder={t("handpick.search")}
                        onChange={(event) => setSearch(event.target.value)}
                        className={cx(inputClass, "py-1.5 text-xs")}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() =>
                          setSelected(new Set(searchResults.map((c) => c.id)))
                        }
                      >
                        {t("handpick.selectAll")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked || selected.size === 0}
                        onClick={() => setSelected(new Set())}
                      >
                        {t("handpick.clear")}
                      </Button>
                    </div>
                    <ul className="thin-scroll max-h-56 space-y-0.5 overflow-y-auto pr-2 text-xs">
                      {searchResults.slice(0, 300).map((city) => (
                        <li key={city.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-chart-800/60">
                            <input
                              type="checkbox"
                              checked={selected.has(city.id)}
                              disabled={locked}
                              onChange={() => toggleSelected(city.id)}
                              className="accent-beacon-500"
                            />
                            <span className="text-chart-200">
                              {cityName(city, locale)}
                              {city.country && (
                                <span className="ml-1.5 text-chart-500">
                                  {city.country}
                                </span>
                              )}
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-[11px] text-chart-500">
                              {formatPopulation(city.population)}
                            </span>
                          </label>
                        </li>
                      ))}
                      {searchResults.length > 300 && (
                        <li className="px-1.5 py-1 text-chart-500">
                          {t("picker.andMore", {
                            count: searchResults.length - 300,
                          })}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {filtered.length > 0 && !handpick && (
                  <>
                    <MiniMap cities={filtered} labels={false} height={180} />

                    <details className="text-xs text-chart-400">
                      <summary className="cursor-pointer text-chart-300 hover:text-chart-100">
                        {t("builder.check")}
                      </summary>
                      <ul className="thin-scroll mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                        {filtered.slice(0, 40).map((city) => (
                          <li
                            key={city.id}
                            className="flex justify-between gap-3 border-b border-chart-800 py-1"
                          >
                            <span className="text-chart-200">
                              {cityName(city, locale)}
                              {city.country && (
                                <span className="ml-1.5 text-chart-500">
                                  {city.country}
                                </span>
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
                    </details>
                  </>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
                    {t("builder.field.name")}
                  </span>
                  <input
                    type="text"
                    value={name}
                    disabled={locked}
                    placeholder={resolvedName}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface RangeFieldProps {
  label: string;
  min: number;
  max: number;
  minBound: number;
  maxBound: number;
  disabled?: boolean;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

const RangeField = ({
  label,
  min,
  max,
  minBound,
  maxBound,
  disabled,
  onMinChange,
  onMaxChange,
}: RangeFieldProps) => (
  <div>
    <div className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
      {label}
    </div>
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={min}
        min={minBound}
        max={maxBound}
        disabled={disabled}
        onChange={(event) => onMinChange(Number(event.target.value))}
        className={cx(inputClass, "py-1.5 text-xs")}
        aria-label={`${label} min`}
      />
      <span className="text-chart-500">–</span>
      <input
        type="number"
        value={max}
        min={minBound}
        max={maxBound}
        disabled={disabled}
        onChange={(event) => onMaxChange(Number(event.target.value))}
        className={cx(inputClass, "py-1.5 text-xs")}
        aria-label={`${label} max`}
      />
    </div>
  </div>
);

export default CitySetBuilder;
