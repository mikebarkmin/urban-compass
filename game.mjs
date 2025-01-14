/**
 * @typedef {Object} City
 * @property {string} name - The name of the city.
 * @property {string} countryCode - The country code of the city.
 * @property {string} country - The country name of the city.
 * @property {string} continent - The continent of the city.
 * @property {number} lat - The latitude of the city.
 * @property {number} lon - The longitude of the city.
 * @property {number} population - The population of the city.
 */

/**
 * The default state of the game.
 * @typedef {Object} Cities
 * @property {City[]} cities - The list of cities in the game.
 * @property {City|null} north - The northernmost city.
 * @property {City|null} south - The southernmost city.
 * @property {City|null} east - The easternmost city.
 * @property {City|null} west - The westernmost city.
 * @property {City|null} largest - The city with the largest population.
 * @property {City|null} smallest - The city with the smallest population.
 */

/**
 * The current state of the game.
 * @typedef {Object} GameState
 * @property {City[]} cities - The list of cities in the game.
 * @property {City|null} north - The northernmost city.
 * @property {City|null} south - The southernmost city.
 * @property {City|null} east - The easternmost city.
 * @property {City|null} west - The westernmost city.
 * @property {City|null} largest - The city with the largest population.
 * @property {City|null} smallest - The city with the smallest population.
 */

const SQL = await window.initSqlJs({
  locateFile: (file) => `https://sql.js.org/dist/${file}`,
});
const dbFile = await fetch("geonames.sqlite3").then((res) => res.arrayBuffer());
const db = new SQL.Database(new Uint8Array(dbFile));

/**
 * @type {GameState}
 */
const defaultGameState = {
  cities: [],
  north: null,
  south: null,
  east: null,
  west: null,
  largest: null,
  smallest: null,
};

const gameState = { ...defaultGameState };

const btnNew = document.getElementById("btnNew");
const btnCheck = document.getElementById("btnCheck");

function activateButton(name, cityName) {
  gameState[name] = cityName;

  const cityElements = document.getElementsByClassName("city");
  for (const cityElement of cityElements) {
    const button = cityElement.getElementsByClassName(name)[0];
    button.classList.remove("active");
    if (cityElement.id === cityName) {
      button.classList.add("active");
    }
  }
}

function generateCities() {
  const params = new URLSearchParams(window.location.search);
  const population = params.get("population") || 15000;
  let stmt = `SELECT * FROM guess WHERE country = 'Germany' AND population >= ${population} ORDER BY RANDOM() LIMIT 4`
  if (params.get("region") === "eu") {
    stmt = `SELECT * FROM guess WHERE continent = 'EU' AND population >= ${population} ORDER BY RANDOM() LIMIT 4`
  } else if (params.get("region") === "world") { 
    stmt = `SELECT * FROM guess WHERE population >= ${population} ORDER BY RANDOM() LIMIT 4`
  }
  const res = db.exec(
    stmt
  );

  gameState.cities = [];

  for (let r of res[0].values) {
    /**
     * @type {City}
     */
    const city = {
      name: r[1],
      countryCode: r[3],
      country: r[4],
      continent: r[5],
      lat: r[8],
      lon: r[9],
      population: r[6],
    };
    gameState.cities.push(city);
  }

  const cities = document.getElementById("cities");
  cities.innerHTML = "";
  for (let city of gameState.cities) {
    const cityElement = document.createElement("div");
    cityElement.id = city.name;
    cityElement.className = "city";
    cityElement.innerHTML = city.name;
    cities.appendChild(cityElement);

    const cardinalDirections = document.createElement("div");
    cardinalDirections.className = "cardinal-directions";

    const northBtn = document.createElement("button");
    northBtn.className = "north";
    northBtn.innerHTML = "N";
    northBtn.addEventListener("click", () => activateButton("north", city.name));
    cardinalDirections.appendChild(northBtn);

    const southBtn = document.createElement("button");
    southBtn.className = "south";
    southBtn.innerHTML = "S";
    southBtn.addEventListener("click", () => activateButton("south", city.name));
    cardinalDirections.appendChild(southBtn);

    const eastBtn = document.createElement("button");
    eastBtn.className = "east";
    eastBtn.innerHTML = "O";
    eastBtn.addEventListener("click", () => activateButton("east", city.name));
    cardinalDirections.appendChild(eastBtn);

    const westBtn = document.createElement("button");
    westBtn.className = "west";
    westBtn.innerHTML = "W";
    westBtn.addEventListener("click", () => activateButton("west", city.name));
    cardinalDirections.appendChild(westBtn);

    const population = document.createElement("div");
    population.className = "population";

    const smallestPopulationBtn = document.createElement("button");
    smallestPopulationBtn.className = "smallest";
    smallestPopulationBtn.innerHTML = "K";
    smallestPopulationBtn.addEventListener(
      "click",
      () => activateButton("smallest", city.name)
    );
    population.appendChild(smallestPopulationBtn);

    const largestPopulationBtn = document.createElement("button");
    largestPopulationBtn.className = "largest";
    largestPopulationBtn.innerHTML = "G";
    largestPopulationBtn.addEventListener(
      "click",
      () => activateButton("largest", city.name)
    );
    population.appendChild(largestPopulationBtn);

    cityElement.appendChild(cardinalDirections);
    cityElement.appendChild(population);
  }

  btnNew.classList.add("hide");
  btnCheck.classList.remove("hide");
}

function checkCities() {
    const maxNorthCity = gameState.cities.reduce((acc, city) => {
        return acc.lat > city.lat ? acc : city;
    });
    const maxSourthCity = gameState.cities.reduce((acc, city) => {
        return acc.lat < city.lat ? acc : city;
    });
    const maxEastCity = gameState.cities.reduce((acc, city) => {
        return acc.lon > city.lon ? acc : city;
    });
    const maxWestCity = gameState.cities.reduce((acc, city) => {
        return acc.lon < city.lon ? acc : city;
    });
    const largestPopulationCity = gameState.cities.reduce((acc, city) => {
        return acc.population > city.population ? acc : city;
    });
    const smallestPopulationCity = gameState.cities.reduce((acc, city) => {
        return acc.population < city.population ? acc : city;
    });

    document.getElementById(maxNorthCity.name).getElementsByClassName("north")[0].classList.add("correct");
    document.getElementById(maxSourthCity.name).getElementsByClassName("south")[0].classList.add("correct");
    document.getElementById(maxEastCity.name).getElementsByClassName("east")[0].classList.add("correct");
    document.getElementById(maxWestCity.name).getElementsByClassName("west")[0].classList.add("correct");
    document.getElementById(largestPopulationCity.name).getElementsByClassName("largest")[0].classList.add("correct");
    document.getElementById(smallestPopulationCity.name).getElementsByClassName("smallest")[0].classList.add("correct");
    
    let correct = 0;
    let wrong = 0;
    if (gameState.north === maxNorthCity.name) {
        correct++;
    } else {
        wrong++;
    }
    if (gameState.south === maxSourthCity.name) {
        correct++;
    } else {
        wrong++;
    }
    if (gameState.east === maxEastCity.name) {
        correct++;
    } else {
        wrong++;
    }
    if (gameState.west === maxWestCity.name) {
        correct++;
    } else {
        wrong++;
    }
    if (gameState.largest === largestPopulationCity.name) {
        correct++;
    } else {
        wrong++;
    }
    if (gameState.smallest === smallestPopulationCity.name) {
        correct++;
    } else {
        wrong++;
    }

    if(confirm(`Richtig: ${correct}, Falsch: ${wrong}. Dürcke Abbrechen, um es nochmal zu probieren oder OK, um die Lösung zu sehen.`)) {
        revealCities();
    }
}

function revealCities() {
  for (let city of gameState.cities) {
    const cityElement = document.getElementById(city.name);
    const spacer = document.createElement("div");
    spacer.className = "spacer";
    cityElement.append(spacer);

    const country = document.createElement("div");
    country.className = "country";
    country.innerHTML = city.country + "(" + city.continent + ")";
    cityElement.appendChild(country);

    const longitude = document.createElement("div");
    longitude.className = "longitude";
    longitude.innerHTML = `Lon: ${city.lon}`;
    cityElement.appendChild(longitude);
    const latitude = document.createElement("div");
    latitude.className = "latitude";
    latitude.innerHTML = `Lat: ${city.lat}`;
    cityElement.appendChild(latitude);
    const population = document.createElement("div");
    population.className = "population";
    const pop = new Intl.NumberFormat("de-DE").format(city.population);
    population.innerHTML = `Bevölkerung: ${pop}`;
    cityElement.appendChild(population);
  }

  btnCheck.classList.add("hide");
  btnNew.classList.remove("hide");
}

btnNew.addEventListener("click", generateCities);
btnCheck.addEventListener("click", checkCities);
