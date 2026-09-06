// Build a KMZ file from a `City[]`, the inverse of `utils/kmz.ts`'s reader.
//
// The KML carries `<Point><coordinates>` geometry (lon,lat order, as KML
// mandates) so Google Earth and Google Maps can place the placemarks, and
// duplicates latitude / longitude / population / country / elevation / nameDe
// in `<ExtendedData>` columns so the output round-trips through the app's own
// `parseKml` reader (which reads population from columns, not geometry). The
// KMZ is a single-entry ZIP archive (deflate-raw, matching what the reader
// expects), produced entirely in the browser — no dependency.

import { City } from "../../game/cities";
import { downloadBlob } from "./index";

/** XML-escape the handful of characters that matter in element text. */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatCoord = (value: number): string =>
  Math.round(value * 1_000_000) / 1_000_000 + "";

/** Build the KML document for a city set.
 *
 * Emits both `<Point><coordinates>` (for Google Earth/Maps) and
 * `<ExtendedData>` columns (for the app's own reader, which reads population
 * from columns). Column names match the reader's `NAME_HINTS`. */
export const buildKml = (name: string, cities: City[]): string => {
  const placemarks = cities
    .map((city) => {
      const fields = [
        `<Data name="latitude"><value>${formatCoord(city.latitude)}</value></Data>`,
        `<Data name="longitude"><value>${formatCoord(city.longitude)}</value></Data>`,
        `<Data name="population"><value>${city.population}</value></Data>`,
        city.country
          ? `<Data name="country"><value>${escapeXml(city.country)}</value></Data>`
          : "",
        city.elevation !== undefined
          ? `<Data name="elevation"><value>${city.elevation}</value></Data>`
          : "",
        city.nameDe
          ? `<Data name="nameDe"><value>${escapeXml(city.nameDe)}</value></Data>`
          : "",
      ]
        .filter(Boolean)
        .join("\n        ");

      return `    <Placemark>
      <name>${escapeXml(city.name)}</name>
      <Point><coordinates>${formatCoord(city.longitude)},${formatCoord(city.latitude)}</coordinates></Point>
      <ExtendedData>
        ${fields}
      </ExtendedData>
    </Placemark>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
${placemarks}
  </Document>
</kml>
`;
};

// ---------------------------------------------------------------------------
// ZIP (single-entry, deflate-raw)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/** DOS time/date fields the ZIP header wants; precision is irrelevant here. */
const dosDateTime = (): { time: number; date: number } => ({
  time: 0,
  date: (1 << 5) | 1, // 1980-01-01
});

const uint16 = (view: DataView, offset: number, value: number) =>
  view.setUint16(offset, value, true);
const uint32 = (view: DataView, offset: number, value: number) =>
  view.setUint32(offset, value, true);

/**
 * Zip a single file (`doc.kml`) into a KMZ Blob. Compression uses the
 * platform's `CompressionStream("deflate-raw")`, which pairs with the
 * `DecompressionStream("deflate-raw")` the reader uses.
 */
const zip = async (filename: string, content: string): Promise<Blob> => {
  const encoder = new TextEncoder();
  const uncompressed = encoder.encode(content);

  const compressed =
    typeof CompressionStream === "undefined"
      ? uncompressed
      : new Uint8Array(
          await new Response(
            new Blob([uncompressed]).stream().pipeThrough(
              new CompressionStream("deflate-raw"),
            ),
          ).arrayBuffer(),
        );

  const method = typeof CompressionStream === "undefined" ? 0 : 8;
  const nameBytes = encoder.encode(filename);
  const crc = crc32(uncompressed);
  const { time, date } = dosDateTime();

  // local file header (30) + name + data
  const localSize = 30 + nameBytes.length + compressed.length;
  // central directory (46) + name
  const cdSize = 46 + nameBytes.length;
  const total = localSize + cdSize + 22;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // Local file header.
  uint32(view, 0, 0x04034b50);
  uint16(view, 4, 20); // version needed
  uint16(view, 6, 0); // flags
  uint16(view, 8, method);
  uint16(view, 10, time);
  uint16(view, 12, date);
  uint32(view, 14, crc);
  uint32(view, 18, compressed.length);
  uint32(view, 22, uncompressed.length);
  uint16(view, 26, nameBytes.length);
  uint16(view, 28, 0); // extra
  out.set(nameBytes, 30);
  out.set(compressed, 30 + nameBytes.length);

  // Central directory.
  const cdOffset = localSize;
  uint32(view, cdOffset, 0x02014b50);
  uint16(view, cdOffset + 4, 20); // version made by
  uint16(view, cdOffset + 6, 20); // version needed
  uint16(view, cdOffset + 8, 0); // flags
  uint16(view, cdOffset + 10, method);
  uint16(view, cdOffset + 12, time);
  uint16(view, cdOffset + 14, date);
  uint32(view, cdOffset + 16, crc);
  uint32(view, cdOffset + 20, compressed.length);
  uint32(view, cdOffset + 24, uncompressed.length);
  uint16(view, cdOffset + 28, nameBytes.length);
  uint16(view, cdOffset + 30, 0); // extra
  uint16(view, cdOffset + 32, 0); // comment
  uint16(view, cdOffset + 34, 0); // disk start
  uint16(view, cdOffset + 36, 0); // internal attrs
  uint32(view, cdOffset + 38, 0); // external attrs
  uint32(view, cdOffset + 42, 0); // local header offset
  out.set(nameBytes, cdOffset + 46);

  // End of central directory.
  const eocd = cdOffset + cdSize;
  uint32(view, eocd, 0x06054b50);
  uint16(view, eocd + 4, 0); // disk
  uint16(view, eocd + 6, 0); // disk with cd
  uint16(view, eocd + 8, 1); // entries on this disk
  uint16(view, eocd + 10, 1); // total entries
  uint32(view, eocd + 12, cdSize); // cd size
  uint32(view, eocd + 16, cdOffset); // cd offset
  uint16(view, eocd + 20, 0); // comment length

  return new Blob([out], { type: "application/vnd.google-earth.kmz" });
};

/**
 * Build a KMZ file from a city set and trigger a download in the browser.
 */
export const exportKmz = async (name: string, cities: City[]): Promise<void> => {
  const kml = buildKml(name, cities);
  const blob = await zip("doc.kml", kml);
  downloadBlob(blob, `${name.replace(/[^\w\-]+/g, "_") || "city_set"}.kmz`);
};
