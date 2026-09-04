// The world's household names — every inhabited continent, nothing obscure.
//
// Coordinates are city-centre decimal degrees, populations approximate
// city-proper figures, elevations metres above sea level, areas the
// administrative area of the city proper in km². All approximate published
// figures.
//
// Note how far apart the altitude cards sit here: La Paz at 3,640 m against
// Rio at 2 m, which makes the altitude pair worth playing on this set.

import { City } from "../cities";

export const worldEasyCities: City[] = [
  { id: "tokyo", name: "Tokyo", nameDe: "Tokio", country: "JP", latitude: 35.6895, longitude: 139.6917, population: 13960000, elevation: 40, area: 627 },
  { id: "new-york", name: "New York", country: "US", latitude: 40.7128, longitude: -74.006, population: 8800000, elevation: 10, area: 778 },
  { id: "london", name: "London", country: "GB", latitude: 51.5074, longitude: -0.1278, population: 8900000, elevation: 11, area: 1572 },
  { id: "paris", name: "Paris", country: "F", latitude: 48.8566, longitude: 2.3522, population: 2140000, elevation: 35, area: 105 },
  { id: "beijing", name: "Beijing", nameDe: "Peking", country: "CN", latitude: 39.9042, longitude: 116.4074, population: 21500000, elevation: 44, area: 16411 },
  { id: "shanghai", name: "Shanghai", country: "CN", latitude: 31.2304, longitude: 121.4737, population: 24870000, elevation: 4, area: 6341 },
  { id: "delhi", name: "Delhi", country: "IN", latitude: 28.7041, longitude: 77.1025, population: 16800000, elevation: 216, area: 1484 },
  { id: "mumbai", name: "Mumbai", country: "IN", latitude: 19.076, longitude: 72.8777, population: 12440000, elevation: 14, area: 603 },
  { id: "cairo", name: "Cairo", nameDe: "Kairo", country: "EG", latitude: 30.0444, longitude: 31.2357, population: 9540000, elevation: 23, area: 3085 },
  { id: "lagos", name: "Lagos", country: "NG", latitude: 6.5244, longitude: 3.3792, population: 15400000, elevation: 12, area: 1171 },
  { id: "nairobi", name: "Nairobi", country: "KE", latitude: -1.2921, longitude: 36.8219, population: 4400000, elevation: 1795, area: 696 },
  { id: "johannesburg", name: "Johannesburg", country: "ZA", latitude: -26.2041, longitude: 28.0473, population: 5630000, elevation: 1753, area: 1645 },
  { id: "cape-town", name: "Cape Town", nameDe: "Kapstadt", country: "ZA", latitude: -33.9249, longitude: 18.4241, population: 4600000, elevation: 25, area: 2461 },
  { id: "sydney", name: "Sydney", country: "AU", latitude: -33.8688, longitude: 151.2093, population: 5300000, elevation: 3, area: 12368 },
  { id: "melbourne", name: "Melbourne", country: "AU", latitude: -37.8136, longitude: 144.9631, population: 5000000, elevation: 31, area: 9993 },
  { id: "auckland", name: "Auckland", country: "NZ", latitude: -36.8485, longitude: 174.7633, population: 1650000, elevation: 26, area: 1086 },
  { id: "los-angeles", name: "Los Angeles", country: "US", latitude: 34.0522, longitude: -118.2437, population: 3900000, elevation: 93, area: 1302 },
  { id: "mexico-city", name: "Mexico City", nameDe: "Mexiko-Stadt", country: "MX", latitude: 19.4326, longitude: -99.1332, population: 9210000, elevation: 2240, area: 1495 },
  { id: "bogota", name: "Bogotá", country: "CO", latitude: 4.711, longitude: -74.0721, population: 7900000, elevation: 2640, area: 1775 },
  { id: "lima", name: "Lima", country: "PE", latitude: -12.0464, longitude: -77.0428, population: 9750000, elevation: 154, area: 2672 },
  { id: "la-paz", name: "La Paz", country: "BO", latitude: -16.5, longitude: -68.1193, population: 816000, elevation: 3640, area: 472 },
  { id: "buenos-aires", name: "Buenos Aires", country: "AR", latitude: -34.6037, longitude: -58.3816, population: 3120000, elevation: 25, area: 203 },
  { id: "sao-paulo", name: "São Paulo", country: "BR", latitude: -23.5505, longitude: -46.6333, population: 12330000, elevation: 760, area: 1521 },
  { id: "rio-de-janeiro", name: "Rio de Janeiro", country: "BR", latitude: -22.9068, longitude: -43.1729, population: 6750000, elevation: 2, area: 1200 },
  { id: "santiago", name: "Santiago", nameDe: "Santiago de Chile", country: "CL", latitude: -33.4489, longitude: -70.6693, population: 6250000, elevation: 570, area: 641 },
  { id: "toronto", name: "Toronto", country: "CA", latitude: 43.6532, longitude: -79.3832, population: 2790000, elevation: 76, area: 630 },
  { id: "vancouver", name: "Vancouver", country: "CA", latitude: 49.2827, longitude: -123.1207, population: 662000, elevation: 2, area: 115 },
  { id: "chicago", name: "Chicago", country: "US", latitude: 41.8781, longitude: -87.6298, population: 2700000, elevation: 182, area: 606 },
  { id: "moscow", name: "Moscow", nameDe: "Moskau", country: "RU", latitude: 55.7558, longitude: 37.6173, population: 12500000, elevation: 156, area: 2511 },
  { id: "istanbul", name: "Istanbul", country: "TR", latitude: 41.0082, longitude: 28.9784, population: 15500000, elevation: 39, area: 5343 },
  { id: "dubai", name: "Dubai", country: "AE", latitude: 25.2048, longitude: 55.2708, population: 3400000, elevation: 5, area: 1610 },
  { id: "singapore", name: "Singapore", nameDe: "Singapur", country: "SG", latitude: 1.3521, longitude: 103.8198, population: 5900000, elevation: 15, area: 728 },
  { id: "bangkok", name: "Bangkok", country: "TH", latitude: 13.7563, longitude: 100.5018, population: 8300000, elevation: 2, area: 1569 },
  { id: "jakarta", name: "Jakarta", country: "ID", latitude: -6.2088, longitude: 106.8456, population: 10560000, elevation: 8, area: 662 },
  { id: "seoul", name: "Seoul", country: "KR", latitude: 37.5665, longitude: 126.978, population: 9700000, elevation: 38, area: 605 },
  { id: "manila", name: "Manila", country: "PH", latitude: 14.5995, longitude: 120.9842, population: 1850000, elevation: 5, area: 43 },
];
