// German cities with coordinates (latitude, longitude) and population data
// Source: Approximate data based on public information

export interface City {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  population: number;
}

// Major German cities with their approximate coordinates and populations
export const germanCities: City[] = [
  {
    id: "berlin",
    name: "Berlin",
    latitude: 52.5200,
    longitude: 13.4050,
    population: 3750000,
  },
  {
    id: "hamburg",
    name: "Hamburg",
    latitude: 53.5511,
    longitude: 9.9937,
    population: 1900000,
  },
  {
    id: "munich",
    name: "Munich (München)",
    latitude: 48.1351,
    longitude: 11.5820,
    population: 1500000,
  },
  {
    id: "cologne",
    name: "Cologne (Köln)",
    latitude: 50.9375,
    longitude: 6.9603,
    population: 1100000,
  },
  {
    id: "frankfurt",
    name: "Frankfurt",
    latitude: 50.1109,
    longitude: 8.6821,
    population: 760000,
  },
  {
    id: "stuttgart",
    name: "Stuttgart",
    latitude: 48.7758,
    longitude: 9.1829,
    population: 630000,
  },
  {
    id: "dusseldorf",
    name: "Düsseldorf",
    latitude: 51.2277,
    longitude: 6.7735,
    population: 620000,
  },
  {
    id: "leipzig",
    name: "Leipzig",
    latitude: 51.3397,
    longitude: 12.3731,
    population: 600000,
  },
  {
    id: "dortmund",
    name: "Dortmund",
    latitude: 51.5136,
    longitude: 7.4653,
    population: 590000,
  },
  {
    id: "essen",
    name: "Essen",
    latitude: 51.4556,
    longitude: 7.0116,
    population: 585000,
  },
  {
    id: "bremen",
    name: "Bremen",
    latitude: 53.0793,
    longitude: 8.8017,
    population: 570000,
  },
  {
    id: "dresden",
    name: "Dresden",
    latitude: 51.0504,
    longitude: 13.7373,
    population: 560000,
  },
  {
    id: "hannover",
    name: "Hannover",
    latitude: 52.3759,
    longitude: 9.7320,
    population: 540000,
  },
  {
    id: "nuremberg",
    name: "Nuremberg (Nürnberg)",
    latitude: 49.4521,
    longitude: 11.0767,
    population: 530000,
  },
  {
    id: "duisburg",
    name: "Duisburg",
    latitude: 51.4344,
    longitude: 6.7623,
    population: 500000,
  },
  {
    id: "bochum",
    name: "Bochum",
    latitude: 51.4818,
    longitude: 7.2165,
    population: 365000,
  },
  {
    id: "wuppertal",
    name: "Wuppertal",
    latitude: 51.2563,
    longitude: 7.1878,
    population: 360000,
  },
  {
    id: "bielefeld",
    name: "Bielefeld",
    latitude: 52.0333,
    longitude: 8.5333,
    population: 335000,
  },
  {
    id: "bonn",
    name: "Bonn",
    latitude: 50.7374,
    longitude: 7.0982,
    population: 335000,
  },
  {
    id: "rostock",
    name: "Rostock",
    latitude: 54.0889,
    longitude: 12.1400,
    population: 209000,
  },
  {
    id: "kiel",
    name: "Kiel",
    latitude: 54.3233,
    longitude: 10.1228,
    population: 247000,
  },
  {
    id: "mainz",
    name: "Mainz",
    latitude: 50.0012,
    longitude: 8.2476,
    population: 220000,
  },
  {
    id: "aachen",
    name: "Aachen",
    latitude: 50.7767,
    longitude: 6.0839,
    population: 265000,
  },
  {
    id: "augsburg",
    name: "Augsburg",
    latitude: 48.3705,
    longitude: 10.8978,
    population: 295000,
  },
  {
    id: "freiburg",
    name: "Freiburg",
    latitude: 47.9990,
    longitude: 7.8421,
    population: 235000,
  },
  {
    id: "karlsruhe",
    name: "Karlsruhe",
    latitude: 49.0069,
    longitude: 8.4037,
    population: 310000,
  },
  {
    id: "kassel",
    name: "Kassel",
    latitude: 51.3167,
    longitude: 9.4833,
    population: 200000,
  },
  {
    id: "lubeck",
    name: "Lübeck",
    latitude: 53.8656,
    longitude: 10.6894,
    population: 215000,
  },
  {
    id: "magdeburg",
    name: "Magdeburg",
    latitude: 52.1205,
    longitude: 11.6276,
    population: 240000,
  },
  {
    id: "mannheim",
    name: "Mannheim",
    latitude: 49.4875,
    longitude: 8.4660,
    population: 315000,
  },
  {
    id: "msster",
    name: "Münster",
    latitude: 51.9624,
    longitude: 7.6256,
    population: 315000,
  },
  {
    id: "wiesbaden",
    name: "Wiesbaden",
    latitude: 50.0826,
    longitude: 8.2468,
    population: 280000,
  },
  {
    id: "mohlin",
    name: "Möhlint",
    latitude: 53.7000,
    longitude: 9.7000,
    population: 10000,
  },
  {
    id: "garmisch",
    name: "Garmisch-Partenkirchen",
    latitude: 47.4919,
    longitude: 11.0936,
    population: 27000,
  },
  {
    id: "flensburg",
    name: "Flensburg",
    latitude: 54.7855,
    longitude: 9.4386,
    population: 90000,
  },
  {
    id: "passau",
    name: "Passau",
    latitude: 48.5667,
    longitude: 13.4500,
    population: 53000,
  },
  {
    id: "konstanz",
    name: "Konstanz",
    latitude: 47.6900,
    longitude: 9.1800,
    population: 85000,
  },
  {
    id: "gorlitz",
    name: "Görlitz",
    latitude: 51.1500,
    longitude: 14.9833,
    population: 56000,
  },
  {
    id: "saarbruecken",
    name: "Saarbrücken",
    latitude: 49.2339,
    longitude: 6.9956,
    population: 180000,
  },
  {
    id: "trier",
    name: "Trier",
    latitude: 49.7556,
    longitude: 6.6403,
    population: 110000,
  },
];

// Category types for the game
export type Category = 
  | "northernmost"
  | "southernmost"
  | "easternmost"
  | "westernmost"
  | "most_population"
  | "least_population";

// Scoring values for correct guesses based on queue position
export const SCORING_VALUES: Record<number, number> = {
  1: 10,  // First correct guess gets 10 points
  2: 7,   // Second gets 7
  3: 5,   // Third gets 5
  4: 3,   // Fourth gets 3
  5: 2,   // Fifth gets 2
  6: 1,   // Sixth gets 1
};

// Category display names
export const categoryDisplayNames: Record<Category, string> = {
  northernmost: "Northernmost City",
  southernmost: "Southernmost City",
  easternmost: "Easternmost City",
  westernmost: "Westernmost City",
  most_population: "Most Inhabitants",
  least_population: "Fewest Inhabitants",
};

// Determine the correct answer for each category based on a set of cities
export const getCorrectAnswers = (cities: City[]): Record<Category, City> => {
  if (cities.length === 0) {
    throw new Error("No cities provided");
  }
  
  // Find northernmost (highest latitude)
  const northernmost = cities.reduce((max, city) => 
    city.latitude > max.latitude ? city : max
  );
  
  // Find southernmost (lowest latitude)
  const southernmost = cities.reduce((min, city) => 
    city.latitude < min.latitude ? city : min
  );
  
  // Find easternmost (highest longitude)
  const easternmost = cities.reduce((max, city) => 
    city.longitude > max.longitude ? city : max
  );
  
  // Find westernmost (lowest longitude)
  const westernmost = cities.reduce((min, city) => 
    city.longitude < min.longitude ? city : min
  );
  
  // Find most population
  const mostPopulation = cities.reduce((max, city) => 
    city.population > max.population ? city : max
  );
  
  // Find least population
  const leastPopulation = cities.reduce((min, city) => 
    city.population < min.population ? city : min
  );
  
  return {
    northernmost,
    southernmost,
    easternmost,
    westernmost,
    most_population: mostPopulation,
    least_population: leastPopulation,
  };
};

// Select a random subset of cities for a game round
export const selectRandomCities = (count: number = 8): City[] => {
  const shuffled = [...germanCities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Get all categories
export const ALL_CATEGORIES: Category[] = [
  "northernmost",
  "southernmost",
  "easternmost",
  "westernmost",
  "most_population",
  "least_population",
];
