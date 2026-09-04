/**
 * Client-side reader for KMZ / KML city lists.
 *
 * A KMZ is a ZIP archive holding a `doc.kml`, so this module contains a small
 * ZIP reader (built on the platform's `DecompressionStream`) plus a KML parser
 * that copes with the two shapes these files come in:
 *
 *  - proper `<Point><coordinates>` geometry, and
 *  - spreadsheet exports (Google My Maps) where the latitude, longitude and
 *    population sit in `<ExtendedData>` columns, sometimes without useful names
 *    and sometimes written as degrees.minutes rather than decimal degrees.
 */

import { City } from "../../game/cities";

export interface ParsedCitySet {
  name: string;
  cities: City[];
  /** Placemarks that had to be dropped, with the reason. */
  skipped: { name: string; reason: string }[];
  /** How the coordinates were read, so the UI can explain itself. */
  coordinateFormat: "point" | "decimal" | "degrees-minutes";
  /** Which ExtendedData columns were used, when they were. */
  columns?: { latitude: string; longitude: string; population?: string };
}

export class KmzParseError extends Error {}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** Locate the end-of-central-directory record, scanning back over any comment. */
const findEndOfCentralDirectory = (view: DataView): number => {
  const maxCommentLength = 0xffff;
  const start = Math.max(0, view.byteLength - maxCommentLength - 22);
  for (let offset = view.byteLength - 22; offset >= start; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new KmzParseError("This does not look like a KMZ file (no ZIP directory found).");
};

const readCentralDirectory = (buffer: ArrayBuffer): ZipEntry[] => {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    entries.push({
      name: decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)),
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

const readEntry = async (buffer: ArrayBuffer, entry: ZipEntry): Promise<string> => {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localHeaderOffset, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new KmzParseError("The archive is damaged (bad local file header).");
  }

  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, dataStart, entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return new TextDecoder().decode(compressed);
  }
  if (entry.compressionMethod !== 8) {
    throw new KmzParseError(
      `Unsupported compression in the archive (method ${entry.compressionMethod}).`,
    );
  }
  if (typeof DecompressionStream === "undefined") {
    throw new KmzParseError("This browser cannot unpack KMZ files. Try uploading the .kml instead.");
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
};

/** Pull the KML document out of a KMZ archive. */
const extractKml = async (buffer: ArrayBuffer): Promise<string> => {
  const entries = readCentralDirectory(buffer);
  const kmlEntry =
    entries.find((e) => e.name.toLowerCase() === "doc.kml") ??
    entries.find((e) => e.name.toLowerCase().endsWith(".kml"));

  if (!kmlEntry) {
    throw new KmzParseError("No .kml document inside this KMZ file.");
  }

  return readEntry(buffer, kmlEntry);
};

// ---------------------------------------------------------------------------
// KML
// ---------------------------------------------------------------------------

interface RawPlacemark {
  name: string;
  point: { latitude: number; longitude: number } | null;
  data: Record<string, string>;
}

const textOf = (element: Element | null): string => (element?.textContent ?? "").trim();

const readPlacemarks = (doc: Document): RawPlacemark[] => {
  const placemarks: RawPlacemark[] = [];

  doc.querySelectorAll("Placemark").forEach((placemark) => {
    const data: Record<string, string> = {};

    placemark.querySelectorAll("Data").forEach((entry) => {
      const key = entry.getAttribute("name");
      if (key) data[key] = textOf(entry.querySelector("value"));
    });
    placemark.querySelectorAll("SimpleData").forEach((entry) => {
      const key = entry.getAttribute("name");
      if (key) data[key] = textOf(entry);
    });

    let point: RawPlacemark["point"] = null;
    const coordinates = textOf(placemark.querySelector("Point > coordinates"));
    if (coordinates) {
      // KML orders coordinates lon,lat[,altitude].
      const [lon, lat] = coordinates.split(/\s+/)[0].split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        point = { latitude: lat, longitude: lon };
      }
    }

    placemarks.push({
      name: textOf(placemark.querySelector(":scope > name")),
      point,
      data,
    });
  });

  return placemarks;
};

const parseNumber = (value: string): number | null => {
  const cleaned = value.replace(/[\s',]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Convert a degrees.minutes value (41.09 meaning 41°09') to decimal degrees.
 */
const degreesMinutesToDecimal = (value: number): number => {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  // Two decimal places hold the minutes; anything beyond is a fraction of one.
  const minutes = (absolute - degrees) * 100;
  return sign * (degrees + minutes / 60);
};

/**
 * Decide whether a column of coordinates is written as degrees.minutes.
 *
 * Minutes never reach 60, so a column where *every* fractional part stays below
 * .60 is overwhelmingly unlikely to be decimal degrees once there are enough
 * samples (chance under decimal degrees is roughly 0.6^n).
 */
const looksLikeDegreesMinutes = (values: number[]): boolean => {
  const withFraction = values.filter((v) => Math.abs(v) % 1 > 0.001);
  if (withFraction.length < 12) return false;
  return withFraction.every((v) => {
    const fraction = Math.round(((Math.abs(v) % 1) + Number.EPSILON) * 1000) / 1000;
    return fraction < 0.6;
  });
};

const NAME_HINTS = {
  latitude: /^(lat|latitude|breite|breitengrad|geo[_ -]?lat|y)$/i,
  longitude: /^(lon|lng|long|longitude|laenge|länge|laengengrad|geo[_ -]?lon|x)$/i,
  population: /(pop|population|einwohner|inhabitants|residents)/i,
};

interface ColumnChoice {
  latitude: string;
  longitude: string;
  population?: string;
}

/**
 * Work out which ExtendedData columns hold the latitude, longitude and
 * population. Column names are used when they are meaningful; spreadsheet
 * exports often name them "unnamed (3)", so the values themselves decide.
 */
const chooseColumns = (
  placemarks: RawPlacemark[],
): { columns: ColumnChoice; degreesMinutes: boolean } | null => {
  const keys = Array.from(new Set(placemarks.flatMap((p) => Object.keys(p.data))));
  if (keys.length === 0) return null;

  const numeric = new Map<string, number[]>();
  for (const key of keys) {
    const values = placemarks
      .map((p) => (p.data[key] ?? "").trim())
      .filter((v) => v !== "")
      .map(parseNumber)
      .filter((v): v is number => v !== null);

    // Require most placemarks to carry a number before trusting the column.
    if (values.length >= Math.max(3, placemarks.length * 0.6)) {
      numeric.set(key, values);
    }
  }

  const named = (hint: RegExp) => keys.find((key) => hint.test(key.trim()));

  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const inRange = (values: number[], limit: number) =>
    values.every((v) => v >= -limit && v <= limit);
  const hasFractions = (values: number[]) =>
    values.filter((v) => Math.abs(v) % 1 > 0.0001).length >= values.length * 0.5;

  // Coordinates are the fractional, spread-out columns; ids, ranks and
  // populations are whole numbers and drop out here.
  const candidates = keys.filter((key) => {
    const values = numeric.get(key);
    return !!values && inRange(values, 180) && hasFractions(values) && spread(values) > 1;
  });

  let latitudeKey = named(NAME_HINTS.latitude);
  let longitudeKey = named(NAME_HINTS.longitude);

  if (!latitudeKey || !longitudeKey) {
    const remaining = candidates.filter((key) => key !== latitudeKey && key !== longitudeKey);
    // Spreadsheets write latitude before longitude, and only latitude has to
    // fit inside +/-90. Between those two rules the pair is unambiguous in
    // practice; the host can still swap them in the preview if it guesses wrong.
    latitudeKey ??= remaining.find((key) => inRange(numeric.get(key) ?? [], 90));
    longitudeKey ??= remaining.find((key) => key !== latitudeKey);
  }

  if (!latitudeKey || !longitudeKey) return null;

  const populationKey =
    named(NAME_HINTS.population) ??
    Array.from(numeric.entries())
      .filter(([key]) => key !== latitudeKey && key !== longitudeKey)
      .filter(([, values]) => values.every((v) => v >= 0 && Number.isInteger(v)))
      // Populations are the big whole numbers in the sheet.
      .sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]))
      .filter(([, values]) => Math.max(...values) >= 1000)
      .map(([key]) => key)[0];

  const degreesMinutes =
    looksLikeDegreesMinutes(numeric.get(latitudeKey) ?? []) &&
    looksLikeDegreesMinutes(numeric.get(longitudeKey) ?? []);

  return {
    columns: { latitude: latitudeKey, longitude: longitudeKey, population: populationKey },
    degreesMinutes,
  };
};

const COUNTRY_HINTS = /^(country|land|iso|code|nation|staat)$/i;

// "PT", "IRL", "UK-SCO", "FYROM" — short letter codes, sometimes hyphenated.
const COUNTRY_CODE = /^[A-Za-z]{1,6}(-[A-Za-z]{1,4})?$/;

/** Short code-like tokens look like the country column in these sheets. */
const findCountryColumn = (placemarks: RawPlacemark[], used: Set<string>): string | undefined => {
  const keys = Array.from(new Set(placemarks.flatMap((p) => Object.keys(p.data))));
  const named = keys.find((key) => COUNTRY_HINTS.test(key.trim()));
  if (named) return named;

  return keys
    .filter((key) => !used.has(key))
    .find((key) => {
      const values = placemarks.map((p) => (p.data[key] ?? "").trim()).filter(Boolean);
      if (values.length < placemarks.length * 0.6) return false;
      return values.every((v) => COUNTRY_CODE.test(v));
    });
};

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00df/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Parse a KML document into a playable city pool. */
export const parseKml = (kml: string, fallbackName: string): ParsedCitySet => {
  const doc = new DOMParser().parseFromString(kml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new KmzParseError("The KML inside this file could not be parsed.");
  }

  const placemarks = readPlacemarks(doc);
  if (placemarks.length === 0) {
    throw new KmzParseError("No placemarks found in this file.");
  }

  const documentName = textOf(doc.querySelector("Document > name")) || fallbackName;
  const usePointGeometry = placemarks.filter((p) => p.point).length >= placemarks.length * 0.8;
  const detected = usePointGeometry ? null : chooseColumns(placemarks);

  if (!usePointGeometry && !detected) {
    throw new KmzParseError(
      "Could not find coordinates in this file — no <Point> geometry and no latitude/longitude columns.",
    );
  }

  const usedColumns = new Set<string>();
  if (detected) {
    usedColumns.add(detected.columns.latitude);
    usedColumns.add(detected.columns.longitude);
    if (detected.columns.population) usedColumns.add(detected.columns.population);
  }
  const countryColumn = findCountryColumn(placemarks, usedColumns);

  const cities: City[] = [];
  const skipped: ParsedCitySet["skipped"] = [];
  const usedIds = new Set<string>();

  for (const placemark of placemarks) {
    const rawName = placemark.name.trim();
    if (!rawName) {
      skipped.push({ name: "(unnamed)", reason: "no name" });
      continue;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (placemark.point) {
      latitude = placemark.point.latitude;
      longitude = placemark.point.longitude;
    } else if (detected) {
      const rawLat = parseNumber(placemark.data[detected.columns.latitude] ?? "");
      const rawLon = parseNumber(placemark.data[detected.columns.longitude] ?? "");
      if (rawLat !== null && rawLon !== null) {
        latitude = detected.degreesMinutes ? degreesMinutesToDecimal(rawLat) : rawLat;
        longitude = detected.degreesMinutes ? degreesMinutesToDecimal(rawLon) : rawLon;
      }
    }

    if (latitude === null || longitude === null) {
      skipped.push({ name: rawName, reason: "no coordinates" });
      continue;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      skipped.push({ name: rawName, reason: "coordinates out of range" });
      continue;
    }

    const populationColumn = detected?.columns.population;
    const population = populationColumn
      ? parseNumber(placemark.data[populationColumn] ?? "")
      : null;

    if (population === null) {
      skipped.push({ name: rawName, reason: "no population" });
      continue;
    }

    // "Barcelona (E)" -> "Barcelona"; the bracketed hint is not part of the name.
    const displayName = rawName.replace(/\s*\([^)]*\)\s*$/, "").trim() || rawName;

    let id = slugify(rawName) || `city-${cities.length + 1}`;
    while (usedIds.has(id)) id = `${id}-${cities.length + 1}`;
    usedIds.add(id);

    const country = countryColumn ? (placemark.data[countryColumn] ?? "").trim() : "";

    cities.push({
      id,
      name: displayName,
      country: country || undefined,
      latitude: Math.round(latitude * 10000) / 10000,
      longitude: Math.round(longitude * 10000) / 10000,
      population: Math.round(population),
    });
  }

  return {
    name: documentName,
    cities,
    skipped,
    coordinateFormat: usePointGeometry
      ? "point"
      : detected?.degreesMinutes
        ? "degrees-minutes"
        : "decimal",
    columns: detected?.columns,
  };
};

/** Read a `.kmz` or `.kml` file the host picked into a playable city pool. */
export const parseCityFile = async (file: File): Promise<ParsedCitySet> => {
  const fallbackName = file.name.replace(/\.(kmz|kml)$/i, "");

  if (/\.kml$/i.test(file.name)) {
    return parseKml(await file.text(), fallbackName);
  }

  const buffer = await file.arrayBuffer();
  return parseKml(await extractKml(buffer), fallbackName);
};

/**
 * Swap latitude and longitude across a parsed set. The only real ambiguity in a
 * column-based file is which of the two comes first, so this is the escape
 * hatch when the guess was wrong.
 */
export const swapCoordinates = (parsed: ParsedCitySet): ParsedCitySet => ({
  ...parsed,
  cities: parsed.cities
    .map((city) => ({ ...city, latitude: city.longitude, longitude: city.latitude }))
    // A swap can push a longitude past the poles; those entries are unusable.
    .filter((city) => Math.abs(city.latitude) <= 90),
});

/**
 * Re-read a set whose coordinates were auto-detected as degrees.minutes (or
 * not), with that decision flipped. Lets the host correct a wrong guess without
 * re-uploading.
 */
export const flipCoordinateFormat = (parsed: ParsedCitySet): ParsedCitySet => {
  if (parsed.coordinateFormat === "point") return parsed;

  const toDegreesMinutes = parsed.coordinateFormat === "decimal";
  const convert = (value: number) =>
    toDegreesMinutes
      ? degreesMinutesToDecimal(value)
      : // Undo the conversion: decimal degrees back to the raw degrees.minutes.
        (value < 0 ? -1 : 1) *
        (Math.floor(Math.abs(value)) + ((Math.abs(value) % 1) * 60) / 100);

  return {
    ...parsed,
    coordinateFormat: toDegreesMinutes ? "degrees-minutes" : "decimal",
    cities: parsed.cities.map((city) => ({
      ...city,
      latitude: Math.round(convert(city.latitude) * 10000) / 10000,
      longitude: Math.round(convert(city.longitude) * 10000) / 10000,
    })),
  };
};
