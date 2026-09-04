// Europe, the far corners: the places that decide a compass card.
//
// Deliberately weighted towards the edges of the continent — Svalbard, the
// Azores, the Caspian depression — so that "northernmost" is a real argument
// rather than a glance at the map.
//
// Coordinates are city-centre decimal degrees, populations approximate
// city-proper figures, elevations metres above sea level. This set carries no
// `area`: for a hamlet like Longyearbyen there is no administrative area figure
// worth trusting, so the area cards are simply not offered here.

import { City } from "../cities";

export const europeHardCities: City[] = [
  { id: "longyearbyen", name: "Longyearbyen", country: "SJ", latitude: 78.2232, longitude: 15.6267, population: 2400, elevation: 10 },
  { id: "tromso", name: "Tromsø", country: "N", latitude: 69.6492, longitude: 18.9553, population: 77000, elevation: 10 },
  { id: "murmansk", name: "Murmansk", country: "RU", latitude: 68.9585, longitude: 33.0827, population: 287000, elevation: 50 },
  { id: "narvik", name: "Narvik", country: "N", latitude: 68.4385, longitude: 17.4272, population: 18000, elevation: 8 },
  { id: "kiruna", name: "Kiruna", country: "S", latitude: 67.8558, longitude: 20.2253, population: 17000, elevation: 500 },
  { id: "vorkuta", name: "Vorkuta", nameDe: "Workuta", country: "RU", latitude: 67.4977, longitude: 64.0714, population: 52000, elevation: 180 },
  { id: "rovaniemi", name: "Rovaniemi", country: "FIN", latitude: 66.5039, longitude: 25.7294, population: 64000, elevation: 83 },
  { id: "arkhangelsk", name: "Arkhangelsk", nameDe: "Archangelsk", country: "RU", latitude: 64.5401, longitude: 40.5433, population: 344000, elevation: 7 },
  { id: "nuuk", name: "Nuuk", country: "GL", latitude: 64.1836, longitude: -51.7214, population: 19000, elevation: 70 },
  { id: "akureyri", name: "Akureyri", country: "IS", latitude: 65.6835, longitude: -18.0878, population: 19000, elevation: 10 },
  { id: "torshavn", name: "Tórshavn", country: "FO", latitude: 62.0079, longitude: -6.7724, population: 13000, elevation: 10 },
  { id: "alesund", name: "Ålesund", country: "N", latitude: 62.4722, longitude: 6.1495, population: 67000, elevation: 10 },
  { id: "ponta-delgada", name: "Ponta Delgada", country: "PT", latitude: 37.7412, longitude: -25.6756, population: 68000, elevation: 30 },
  { id: "funchal", name: "Funchal", country: "PT", latitude: 32.6669, longitude: -16.9241, population: 105000, elevation: 25 },
  { id: "las-palmas", name: "Las Palmas", country: "E", latitude: 28.1235, longitude: -15.4363, population: 380000, elevation: 8 },
  { id: "gibraltar", name: "Gibraltar", country: "GBZ", latitude: 36.1408, longitude: -5.3536, population: 34000, elevation: 5 },
  { id: "ceuta", name: "Ceuta", country: "E", latitude: 35.8894, longitude: -5.3213, population: 84000, elevation: 10 },
  { id: "iraklio", name: "Iraklio", country: "GR", latitude: 35.3387, longitude: 25.1442, population: 180000, elevation: 39 },
  { id: "rhodes", name: "Rhodes", nameDe: "Rhodos", country: "GR", latitude: 36.4349, longitude: 28.2176, population: 50000, elevation: 15 },
  { id: "nicosia", name: "Nicosia", nameDe: "Nikosia", country: "CY", latitude: 35.1856, longitude: 33.3823, population: 116000, elevation: 150 },
  { id: "batumi", name: "Batumi", country: "GE", latitude: 41.6168, longitude: 41.6367, population: 170000, elevation: 5 },
  { id: "astrakhan", name: "Astrakhan", nameDe: "Astrachan", country: "RU", latitude: 46.3497, longitude: 48.0408, population: 525000, elevation: -20 },
  { id: "sochi", name: "Sochi", nameDe: "Sotschi", country: "RU", latitude: 43.6028, longitude: 39.7342, population: 466000, elevation: 20 },
  { id: "andorra-la-vella", name: "Andorra la Vella", country: "AND", latitude: 42.5063, longitude: 1.5218, population: 22000, elevation: 1023 },
  { id: "davos", name: "Davos", country: "CH", latitude: 46.8027, longitude: 9.836, population: 11000, elevation: 1560 },
  { id: "zermatt", name: "Zermatt", country: "CH", latitude: 46.0207, longitude: 7.7491, population: 5800, elevation: 1608 },
  { id: "innsbruck", name: "Innsbruck", country: "A", latitude: 47.2692, longitude: 11.4041, population: 132000, elevation: 574 },
  { id: "bolzano", name: "Bolzano", nameDe: "Bozen", country: "I", latitude: 46.4983, longitude: 11.3548, population: 107000, elevation: 262 },
  { id: "chisinau", name: "Chișinău", country: "MOL", latitude: 47.0105, longitude: 28.8638, population: 640000, elevation: 85 },
  { id: "minsk", name: "Minsk", country: "BY", latitude: 53.9006, longitude: 27.559, population: 2000000, elevation: 220 },
  { id: "sarajevo", name: "Sarajevo", country: "BIH", latitude: 43.8563, longitude: 18.4131, population: 275000, elevation: 518 },
  { id: "podgorica", name: "Podgorica", country: "MNE", latitude: 42.4304, longitude: 19.2594, population: 150000, elevation: 45 },
  { id: "tirana", name: "Tirana", country: "AL", latitude: 41.3275, longitude: 19.8187, population: 557000, elevation: 110 },
  { id: "skopje", name: "Skopje", country: "MK", latitude: 41.9981, longitude: 21.4254, population: 526000, elevation: 240 },
  { id: "pristina", name: "Pristina", country: "RKS", latitude: 42.6629, longitude: 21.1655, population: 200000, elevation: 652 },
  { id: "chernivtsi", name: "Chernivtsi", nameDe: "Czernowitz", country: "UKR", latitude: 48.2921, longitude: 25.9358, population: 265000, elevation: 248 },
  { id: "kaliningrad", name: "Kaliningrad", country: "RU", latitude: 54.7104, longitude: 20.4522, population: 489000, elevation: 5 },
  { id: "coleraine", name: "Coleraine", country: "GB-NI", latitude: 55.1326, longitude: -6.6685, population: 24000, elevation: 10 },
  { id: "galway", name: "Galway", country: "IRL", latitude: 53.2707, longitude: -9.0568, population: 80000, elevation: 8 },
  { id: "brest-fr", name: "Brest", country: "F", latitude: 48.3904, longitude: -4.4861, population: 140000, elevation: 35 },
];
