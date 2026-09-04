// The ends of the earth: outposts, capitals nobody can place, and the two or
// three settlements that own a compass card outright.
//
// Alert sits at 82°N and McMurdo at 78°S, so the north/south pair is decided by
// whether either turned up in the draw. Jericho at −258 m and Baku at −28 m do
// the same for altitude.
//
// Coordinates are city-centre decimal degrees, populations approximate
// settlement figures, elevations metres above sea level. No `area`: a research
// station has no administrative area worth quoting, so those cards are not
// offered on this set.

import { City } from "../cities";

export const worldHardCities: City[] = [
  { id: "alert", name: "Alert", country: "CA", latitude: 82.5018, longitude: -62.3481, population: 60, elevation: 30 },
  { id: "utqiagvik", name: "Utqiaġvik", country: "US", latitude: 71.2906, longitude: -156.7887, population: 4900, elevation: 3 },
  { id: "norilsk", name: "Norilsk", country: "RU", latitude: 69.3558, longitude: 88.1893, population: 182000, elevation: 90 },
  { id: "anadyr", name: "Anadyr", country: "RU", latitude: 64.7314, longitude: 177.5015, population: 13000, elevation: 20 },
  { id: "iqaluit", name: "Iqaluit", country: "CA", latitude: 63.7467, longitude: -68.517, population: 7400, elevation: 10 },
  { id: "nuuk", name: "Nuuk", country: "GL", latitude: 64.1836, longitude: -51.7214, population: 19000, elevation: 70 },
  { id: "yakutsk", name: "Yakutsk", nameDe: "Jakutsk", country: "RU", latitude: 62.0355, longitude: 129.6755, population: 336000, elevation: 100 },
  { id: "mcmurdo", name: "McMurdo Station", nameDe: "McMurdo-Station", country: "AQ", latitude: -77.8419, longitude: 166.6863, population: 1000, elevation: 10 },
  { id: "ushuaia", name: "Ushuaia", country: "AR", latitude: -54.8019, longitude: -68.303, population: 75000, elevation: 23 },
  { id: "punta-arenas", name: "Punta Arenas", country: "CL", latitude: -53.1638, longitude: -70.9171, population: 127000, elevation: 34 },
  { id: "suva", name: "Suva", country: "FJ", latitude: -18.1416, longitude: 178.4419, population: 93000, elevation: 6 },
  { id: "papeete", name: "Papeete", country: "PF", latitude: -17.5516, longitude: -149.5585, population: 26000, elevation: 5 },
  { id: "noumea", name: "Nouméa", country: "NC", latitude: -22.2758, longitude: 166.458, population: 94000, elevation: 10 },
  { id: "port-moresby", name: "Port Moresby", country: "PG", latitude: -9.4438, longitude: 147.1803, population: 383000, elevation: 40 },
  { id: "honiara", name: "Honiara", country: "SB", latitude: -9.4456, longitude: 159.9729, population: 85000, elevation: 8 },
  { id: "apia", name: "Apia", country: "WS", latitude: -13.8333, longitude: -171.7667, population: 37000, elevation: 2 },
  { id: "nukualofa", name: "Nukuʻalofa", country: "TO", latitude: -21.1393, longitude: -175.2049, population: 23000, elevation: 4 },
  { id: "hagatna", name: "Hagåtña", country: "GU", latitude: 13.4757, longitude: 144.7489, population: 1050, elevation: 5 },
  { id: "majuro", name: "Majuro", country: "MH", latitude: 7.1164, longitude: 171.1855, population: 28000, elevation: 3 },
  { id: "male", name: "Malé", country: "MV", latitude: 4.1755, longitude: 73.5093, population: 133000, elevation: 2 },
  { id: "thimphu", name: "Thimphu", country: "BT", latitude: 27.4728, longitude: 89.639, population: 115000, elevation: 2320 },
  { id: "kathmandu", name: "Kathmandu", country: "NP", latitude: 27.7172, longitude: 85.324, population: 975000, elevation: 1400 },
  { id: "lhasa", name: "Lhasa", country: "CN", latitude: 29.652, longitude: 91.1721, population: 373000, elevation: 3650 },
  { id: "ulaanbaatar", name: "Ulaanbaatar", country: "MN", latitude: 47.8864, longitude: 106.9057, population: 1600000, elevation: 1350 },
  { id: "bishkek", name: "Bishkek", nameDe: "Bischkek", country: "KG", latitude: 42.8746, longitude: 74.5698, population: 1070000, elevation: 800 },
  { id: "dushanbe", name: "Dushanbe", nameDe: "Duschanbe", country: "TJ", latitude: 38.5598, longitude: 68.787, population: 900000, elevation: 800 },
  { id: "ashgabat", name: "Ashgabat", nameDe: "Aschgabat", country: "TM", latitude: 37.9601, longitude: 58.3261, population: 1030000, elevation: 219 },
  { id: "baku", name: "Baku", country: "AZ", latitude: 40.4093, longitude: 49.8671, population: 2300000, elevation: -28 },
  { id: "jericho", name: "Jericho", country: "PS", latitude: 31.8667, longitude: 35.45, population: 20000, elevation: -258 },
  { id: "quito", name: "Quito", country: "EC", latitude: -0.1807, longitude: -78.4678, population: 2010000, elevation: 2850 },
  { id: "cusco", name: "Cusco", country: "PE", latitude: -13.5319, longitude: -71.9675, population: 430000, elevation: 3400 },
  { id: "potosi", name: "Potosí", country: "BO", latitude: -19.5836, longitude: -65.7531, population: 240000, elevation: 4090 },
  { id: "addis-ababa", name: "Addis Ababa", nameDe: "Addis Abeba", country: "ET", latitude: 9.032, longitude: 38.7469, population: 3350000, elevation: 2355 },
  { id: "asmara", name: "Asmara", country: "ER", latitude: 15.3229, longitude: 38.9251, population: 960000, elevation: 2325 },
  { id: "antananarivo", name: "Antananarivo", country: "MG", latitude: -18.8792, longitude: 47.5079, population: 1275000, elevation: 1280 },
  { id: "windhoek", name: "Windhoek", country: "NA", latitude: -22.5609, longitude: 17.0658, population: 430000, elevation: 1700 },
  { id: "djibouti", name: "Djibouti", nameDe: "Dschibuti", country: "DJ", latitude: 11.5721, longitude: 43.1456, population: 600000, elevation: 12 },
  { id: "timbuktu", name: "Timbuktu", country: "ML", latitude: 16.7735, longitude: -3.0074, population: 32000, elevation: 261 },
];
