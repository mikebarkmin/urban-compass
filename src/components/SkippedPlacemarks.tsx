import { useMemo, useState } from "react";
import Link from "next/link";
import { City } from "../../game/cities";
import { loadCities } from "@/data/citiesLoader";
import { matchDatasetCity } from "@/data/cityLookup";
import {
  CityRepair,
  ParsedCitySet,
  SkipReason,
  SkippedPlacemark,
  isRepairComplete,
  repairSkipped,
} from "@/utils/kmz";
import { useLocale } from "@/i18n";
import { Emoji } from "./Emoji";
import { Button, cx, inputClass } from "./ui";

type Field = "name" | "latitude" | "longitude" | "population";

const FIELDS: Field[] = ["name", "latitude", "longitude", "population"];

/** The reasons in the order they read best: identity, then place, then size. */
const REASON_ORDER: SkipReason[] = [
  "no-name",
  "no-coordinates",
  "coordinates-out-of-range",
  "no-population",
];

/** Same tolerance the parser has: thousands separators are not a typo. */
const toNumber = (value: string): number | null => {
  const cleaned = value.replace(/[\s',]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

/** What the file itself managed to read, which is where each input starts. */
const prefill = (entry: SkippedPlacemark, field: Field): string => {
  const value = field === "name" ? entry.name : entry[field];
  return value === null || value === undefined ? "" : String(value);
};

interface SkippedPlacemarksProps {
  parsed: ParsedCitySet;
  /** Hand back the set with the repaired placemarks folded in. */
  onRepair: (repaired: ParsedCitySet) => void;
  disabled?: boolean;
}

/**
 * The readable side of a partial import: what the file left out, why those
 * placemarks were dropped, and a form to fill the gaps in so they join the set
 * without editing the file and uploading it again.
 *
 * Edits are stored per placemark index rather than as a copy of the rows, so
 * the escape hatches that re-read the whole file (swap lat/lon, flip the
 * coordinate format) flow straight through into the untouched inputs.
 */
const SkippedPlacemarks = ({ parsed, onRepair, disabled }: SkippedPlacemarksProps) => {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<Record<number, Partial<Record<Field, string>>>>({});
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState(false);

  const valueOf = (entry: SkippedPlacemark, field: Field): string =>
    edits[entry.index]?.[field] ?? prefill(entry, field);

  const setValue = (index: number, field: Field, value: string) =>
    setEdits((current) => ({ ...current, [index]: { ...current[index], [field]: value } }));

  const counts = useMemo(() => {
    const tally = new Map<SkipReason, number>();
    for (const entry of parsed.skipped) {
      tally.set(entry.reason, (tally.get(entry.reason) ?? 0) + 1);
    }
    return REASON_ORDER.filter((reason) => tally.has(reason)).map((reason) => ({
      reason,
      count: tally.get(reason) as number,
    }));
  }, [parsed.skipped]);

  const repairs: CityRepair[] = parsed.skipped.map((entry) => ({
    index: entry.index,
    name: valueOf(entry, "name").trim(),
    latitude: toNumber(valueOf(entry, "latitude")) ?? Number.NaN,
    longitude: toNumber(valueOf(entry, "longitude")) ?? Number.NaN,
    population: toNumber(valueOf(entry, "population")) ?? Number.NaN,
    ...(entry.country ? { country: entry.country } : {}),
  }));

  const ready = repairs.filter(isRepairComplete);

  /** Whether one input still holds something the set cannot use. */
  const fieldInvalid = (repair: CityRepair, field: Field): boolean => {
    if (field === "name") return repair.name === "";
    if (field === "population") return !Number.isFinite(repair.population) || repair.population < 0;
    const value = repair[field];
    return !Number.isFinite(value) || Math.abs(value) > (field === "latitude" ? 90 : 180);
  };

  /**
   * Fill the blanks from the geonames dataset. Only empty and unusable inputs
   * are touched — a value the file supplied, or the host typed, wins over a
   * guess made from a map pin.
   */
  const lookUp = async () => {
    setLookupBusy(true);
    setLookedUp(true);
    setLookupNote(null);

    const dataset: City[] = await loadCities();
    if (dataset.length === 0) {
      setLookupBusy(false);
      setLookupNote(t("repair.lookupError"));
      return;
    }

    const filled: Record<number, Partial<Record<Field, string>>> = {};
    const found: Record<number, string> = {};

    for (const [position, entry] of parsed.skipped.entries()) {
      const repair = repairs[position];
      // Without a usable point there is nothing to search around.
      if (fieldInvalid(repair, "latitude") || fieldInvalid(repair, "longitude")) continue;

      const match = matchDatasetCity(dataset, {
        name: repair.name,
        latitude: repair.latitude,
        longitude: repair.longitude,
      });
      if (!match) continue;

      const patch: Partial<Record<Field, string>> = {};
      if (fieldInvalid(repair, "name")) patch.name = match.city.name;
      if (fieldInvalid(repair, "population")) patch.population = String(match.city.population);
      if (Object.keys(patch).length === 0) continue;

      filled[entry.index] = patch;
      found[entry.index] = t("repair.matched", {
        name: match.city.name,
        distance: match.distance,
      });
    }

    const count = Object.keys(filled).length;
    setEdits((current) => {
      const merged = { ...current };
      for (const [index, patch] of Object.entries(filled)) {
        merged[Number(index)] = { ...merged[Number(index)], ...patch };
      }
      return merged;
    });
    setMatches((current) => ({ ...current, ...found }));
    setLookupNote(
      count === 0
        ? t("repair.lookupNone")
        : t("repair.lookupResult", { count, total: parsed.skipped.length }),
    );
    setLookupBusy(false);
  };

  /**
   * Opening the form runs the lookup straight away: the dataset answers most of
   * these on its own, so the host should arrive at a form that is mostly filled
   * in rather than at one more button. The button stays for a second pass after
   * a coordinate has been corrected by hand.
   */
  const toggle = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && !lookedUp) void lookUp();
  };

  const remaining = parsed.skipped.length - ready.length;

  return (
    <div className="rounded-xl border border-alert-500/40 bg-alert-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Emoji symbol="⚠️" alt="" className="h-4 w-4 shrink-0" />
            <span className="font-display text-sm font-semibold text-alert-500">
              {t("repair.title", {
                count: parsed.skipped.length,
                total: parsed.skipped.length + parsed.cities.length,
              })}
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-xs text-chart-300">
            {counts.map(({ reason, count }) => (
              <li key={reason}>{t(`repair.reason.${reason}`, { count })}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-chart-400">
            {t("repair.lede")}{" "}
            <Link href="/help" className="text-chart-300 underline hover:text-chart-100">
              {t("picker.help")}
            </Link>
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={toggle}
        >
          {open ? t("repair.hide") : t("repair.fix", { count: parsed.skipped.length })}
        </Button>
      </div>

      {open && (
        <div className="animate-rise mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || lookupBusy}
              onClick={() => void lookUp()}
            >
              {lookupBusy
                ? t("repair.lookingUp")
                : t(lookedUp ? "repair.lookupAgain" : "repair.lookup")}
            </Button>
            {lookupNote && <span className="text-xs text-chart-400">{lookupNote}</span>}
          </div>

          <div className="thin-scroll max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {parsed.skipped.map((entry, position) => {
              const repair = repairs[position];
              return (
                <div
                  key={entry.index}
                  className="rounded-lg border border-chart-700 bg-chart-900/60 p-2"
                >
                  <div className="grid gap-1.5 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                    {FIELDS.map((field) => (
                      <label key={field} className="block">
                        <span className="mb-0.5 block text-[10px] tracking-[0.12em] text-chart-500 uppercase">
                          {t(`repair.col.${field}`)}
                        </span>
                        <input
                          type="text"
                          inputMode={field === "name" ? "text" : "decimal"}
                          value={valueOf(entry, field)}
                          disabled={disabled}
                          placeholder={t(`repair.col.${field}`)}
                          onChange={(event) => setValue(entry.index, field, event.target.value)}
                          className={cx(
                            inputClass,
                            "px-2 py-1 text-xs",
                            fieldInvalid(repair, field) && "border-alert-500/60",
                          )}
                        />
                      </label>
                    ))}
                  </div>
                  {matches[entry.index] && (
                    <p className="mt-1 text-[11px] text-chart-500">{matches[entry.index]}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={disabled || ready.length === 0}
              onClick={() => {
                onRepair(repairSkipped(parsed, ready));
                setLookupNote(null);
              }}
            >
              {t("repair.add", { count: ready.length })}
            </Button>
            <span className="text-xs text-chart-400">
              {remaining > 0 ? t("repair.remaining", { count: remaining }) : t("repair.allReady")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkippedPlacemarks;
