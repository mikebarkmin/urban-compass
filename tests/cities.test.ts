// Runs on Node 22+ with `node --experimental-strip-types` — no test framework,
// no new dependency. Fails loudly on any wrong number.

import assert from "node:assert/strict";
import {
  distanceKm,
  missOf,
  type City,
} from "../game/cities.ts";

const city = (
  id: string,
  latitude: number,
  longitude: number,
): City => ({ id, name: id, latitude, longitude, population: 0 });

// --- Compass cards report the miss along the category's axis ----------------

// Nairobi (-1.2864 N) vs Manaus (-3.1190 S-of-equator): both southern, so the
// north-south gap is the latitude difference alone, ~204 km. The crow-flies
// distance would be huge — the two cities sit on nearly opposite meridians.
{
  const nairobi = city("nairobi", -1.2864, 36.8172);
  const manaus = city("manaus", -3.119, -60.0217);

  const miss = missOf(manaus, nairobi, "northernmost");
  assert.ok(miss, "a wrong compass guess must report a miss");
  assert.equal(miss.key, "miss.kmNS");
  assert.equal(miss.value, "204");
  // The axis figure is far below the crow-flies distance, which mixes in the
  // 97-degree longitude gap the card never asked about.
  assert.ok(Number(miss.value) < distanceKm(nairobi, manaus) / 10);
}

// Berlin vs Cape Town: 86.44 degrees of latitude -> 9,612 km north-south.
{
  const capeTown = city("cape-town", -33.92, 18.42);
  const berlin = city("berlin", 52.52, 13.405);

  assert.equal(missOf(berlin, capeTown, "southernmost")?.value, "9,612");
  assert.equal(missOf(capeTown, berlin, "northernmost")?.value, "9,612");
}

// East-west is scaled by the cosine of the mean latitude: 10 degrees apart at
// the equator are ~1,112 km, the same gap at 60° only ~556 km.
{
  const east = city("east", 0, 10);
  const west = city("west", 0, 0);
  const equatorial = missOf(west, east, "easternmost");
  assert.equal(equatorial?.key, "miss.kmEW");
  assert.equal(equatorial?.value, "1,112");

  const northEast = city("north-east", 60, 10);
  const northWest = city("north-west", 60, 0);
  assert.equal(missOf(northWest, northEast, "easternmost")?.value, "556");
}

// Antimeridian: 139.7 E and 122.4 W are 98 degrees apart the short way, not 262.
{
  const tokyo = city("tokyo", 35.68, 139.69);
  const sanFrancisco = city("san-francisco", 37.77, -122.42);

  const miss = missOf(sanFrancisco, tokyo, "easternmost");
  assert.equal(miss.key, "miss.kmEW");
  assert.equal(miss.value, "8,724");
}

// --- The non-compass categories are untouched --------------------------------

{
  const big = { ...city("big", 10, 10), population: 1_000_000 };
  const small = { ...city("small", 20, 20), population: 10_000 };
  assert.equal(missOf(small, big, "most_population")?.key, "miss.people");
  assert.equal(missOf(small, big, "most_population")?.value, "990k");

  const high = { ...city("high", 10, 10), elevation: 2000 };
  const low = { ...city("low", 20, 20), elevation: 500 };
  assert.equal(missOf(low, high, "highest")?.value, "1,500");

  const large = { ...city("large", 10, 10), area: 800.4 };
  const tiny = { ...city("tiny", 20, 20), area: 100.2 };
  assert.equal(missOf(tiny, large, "largest_area")?.key, "miss.area");
  assert.equal(missOf(tiny, large, "largest_area")?.value, "700");
}

// A correct guess has nothing to report, and a city missing its coordinates
// stays silent rather than inventing a figure.
{
  const same = city("same", -1.28, 36.8);
  assert.equal(missOf(same, same, "southernmost"), null);

  const naked: City = { ...same, latitude: undefined } as unknown as City;
  assert.equal(missOf(naked, same, "southernmost"), null);
}

console.log("game/cities missOf: all axis-distance tests passed");
