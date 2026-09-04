// Europe, the recognisable half: capitals and the big names.
//
// Coordinates are city-centre decimal degrees. Populations are approximate
// city-proper figures, elevations are metres above sea level at the centre, and
// areas are the administrative area of the city proper in km² — all approximate
// published figures, in the same spirit as the other sets in this folder.
//
// Where "the city" is ambiguous the administrative unit people mean is used:
// Brussels is the Capital Region rather than the small City of Brussels.

import { City } from "../cities";

export const europeEasyCities: City[] = [
  { id: "london", name: "London", country: "GB", latitude: 51.5074, longitude: -0.1278, population: 8900000, elevation: 11, area: 1572 },
  { id: "paris", name: "Paris", country: "F", latitude: 48.8566, longitude: 2.3522, population: 2140000, elevation: 35, area: 105 },
  { id: "berlin", name: "Berlin", country: "D", latitude: 52.52, longitude: 13.405, population: 3660000, elevation: 34, area: 891 },
  { id: "madrid", name: "Madrid", country: "E", latitude: 40.4168, longitude: -3.7038, population: 3220000, elevation: 667, area: 604 },
  { id: "rome", name: "Rome", nameDe: "Rom", country: "I", latitude: 41.9028, longitude: 12.4964, population: 2760000, elevation: 21, area: 1285 },
  { id: "vienna", name: "Vienna", nameDe: "Wien", country: "A", latitude: 48.2082, longitude: 16.3738, population: 1900000, elevation: 171, area: 415 },
  { id: "amsterdam", name: "Amsterdam", country: "NL", latitude: 52.3676, longitude: 4.9041, population: 872000, elevation: -2, area: 219 },
  { id: "brussels", name: "Brussels", nameDe: "Brüssel", country: "B", latitude: 50.8503, longitude: 4.3517, population: 1222000, elevation: 13, area: 162 },
  { id: "lisbon", name: "Lisbon", nameDe: "Lissabon", country: "PT", latitude: 38.7223, longitude: -9.1393, population: 545000, elevation: 2, area: 100 },
  { id: "dublin", name: "Dublin", country: "IRL", latitude: 53.3498, longitude: -6.2603, population: 592000, elevation: 20, area: 118 },
  { id: "copenhagen", name: "Copenhagen", nameDe: "Kopenhagen", country: "DK", latitude: 55.6761, longitude: 12.5683, population: 660000, elevation: 14, area: 90 },
  { id: "stockholm", name: "Stockholm", country: "S", latitude: 59.3293, longitude: 18.0686, population: 984000, elevation: 28, area: 188 },
  { id: "oslo", name: "Oslo", country: "N", latitude: 59.9139, longitude: 10.7522, population: 709000, elevation: 23, area: 454 },
  { id: "helsinki", name: "Helsinki", country: "FIN", latitude: 60.1699, longitude: 24.9384, population: 658000, elevation: 26, area: 214 },
  { id: "warsaw", name: "Warsaw", nameDe: "Warschau", country: "PL", latitude: 52.2297, longitude: 21.0122, population: 1790000, elevation: 100, area: 517 },
  { id: "prague", name: "Prague", nameDe: "Prag", country: "CZ", latitude: 50.0755, longitude: 14.4378, population: 1310000, elevation: 200, area: 496 },
  { id: "budapest", name: "Budapest", country: "H", latitude: 47.4979, longitude: 19.0402, population: 1750000, elevation: 102, area: 525 },
  { id: "athens", name: "Athens", nameDe: "Athen", country: "GR", latitude: 37.9838, longitude: 23.7275, population: 664000, elevation: 70, area: 39 },
  { id: "bucharest", name: "Bucharest", nameDe: "Bukarest", country: "RO", latitude: 44.4268, longitude: 26.1025, population: 1830000, elevation: 70, area: 228 },
  { id: "sofia", name: "Sofia", country: "BG", latitude: 42.6977, longitude: 23.3219, population: 1240000, elevation: 550, area: 492 },
  { id: "zagreb", name: "Zagreb", country: "HR", latitude: 45.815, longitude: 15.9819, population: 767000, elevation: 122, area: 641 },
  { id: "belgrade", name: "Belgrade", nameDe: "Belgrad", country: "SRB", latitude: 44.7866, longitude: 20.4489, population: 1170000, elevation: 117, area: 360 },
  { id: "bern", name: "Bern", country: "CH", latitude: 46.948, longitude: 7.4474, population: 134000, elevation: 540, area: 51 },
  { id: "barcelona", name: "Barcelona", country: "E", latitude: 41.3874, longitude: 2.1686, population: 1620000, elevation: 12, area: 101 },
  { id: "milan", name: "Milan", nameDe: "Mailand", country: "I", latitude: 45.4642, longitude: 9.19, population: 1370000, elevation: 120, area: 182 },
  { id: "munich", name: "Munich", nameDe: "München", country: "D", latitude: 48.1351, longitude: 11.582, population: 1490000, elevation: 519, area: 310 },
  { id: "hamburg", name: "Hamburg", country: "D", latitude: 53.5511, longitude: 9.9937, population: 1850000, elevation: 6, area: 755 },
  { id: "zurich", name: "Zurich", nameDe: "Zürich", country: "CH", latitude: 47.3769, longitude: 8.5417, population: 434000, elevation: 408, area: 88 },
  { id: "reykjavik", name: "Reykjavík", country: "IS", latitude: 64.1466, longitude: -21.9426, population: 135000, elevation: 61, area: 273 },
  { id: "riga", name: "Riga", country: "LET", latitude: 56.9496, longitude: 24.1052, population: 605000, elevation: 6, area: 304 },
  { id: "vilnius", name: "Vilnius", country: "LIT", latitude: 54.6872, longitude: 25.2797, population: 581000, elevation: 112, area: 401 },
  { id: "tallinn", name: "Tallinn", country: "EST", latitude: 59.437, longitude: 24.7536, population: 445000, elevation: 9, area: 159 },
  { id: "kyiv", name: "Kyiv", nameDe: "Kiew", country: "UKR", latitude: 50.4501, longitude: 30.5234, population: 2950000, elevation: 179, area: 839 },
  { id: "moscow", name: "Moscow", nameDe: "Moskau", country: "RU", latitude: 55.7558, longitude: 37.6173, population: 12500000, elevation: 156, area: 2511 },
  { id: "istanbul", name: "Istanbul", country: "TR", latitude: 41.0082, longitude: 28.9784, population: 15500000, elevation: 39, area: 5343 },
  { id: "ljubljana", name: "Ljubljana", country: "SLO", latitude: 46.0569, longitude: 14.5058, population: 285000, elevation: 295, area: 164 },
  { id: "bratislava", name: "Bratislava", country: "SK", latitude: 48.1486, longitude: 17.1077, population: 476000, elevation: 134, area: 368 },
  { id: "luxembourg", name: "Luxembourg", nameDe: "Luxemburg", country: "L", latitude: 49.6116, longitude: 6.1319, population: 128000, elevation: 305, area: 51 },
  { id: "valletta", name: "Valletta", country: "M", latitude: 35.8989, longitude: 14.5146, population: 5900, elevation: 56, area: 0.8 },
  { id: "monaco", name: "Monaco", country: "MC", latitude: 43.7384, longitude: 7.4246, population: 39000, elevation: 16, area: 2 },
];
