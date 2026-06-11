(function () {
  const weatherUrl = "https://weatherfile.com/V03/loc/GBR00005/infowindow.ggl";
  const metresPerSecondToKnots = 1.9438444924406;
  const compass16 = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];

  const logEl = document.getElementById("log");
  const resultCard = document.getElementById("result-card");
  const averageEl = document.getElementById("wind-average");
  const maxEl = document.getElementById("wind-max");
  const directionEl = document.getElementById("wind-direction");
  const spokenEl = document.getElementById("wind-spoken");

  function log(message) {
    logEl.textContent = message;
  }

  function invoke(payload) {
    if (!window.FieldRelayNative || typeof window.FieldRelayNative.invoke !== "function") {
      throw new Error("Native bridge is not available.");
    }
    return JSON.parse(window.FieldRelayNative.invoke(JSON.stringify(payload)));
  }

  function knots(value) {
    return Math.round(Number(value) * metresPerSecondToKnots);
  }

  function compass(degrees) {
    const normalised = ((Number(degrees) % 360) + 360) % 360;
    const index = Math.round(normalised / 22.5) % 16;
    return compass16[index];
  }

  function parseWeatherFile(body) {
    const payload = JSON.parse(body);
    const reading = payload && payload.data && payload.data.lastaverage;
    if (!reading) {
      throw new Error("WeatherFile response did not include data.lastaverage.");
    }
    const average = knots(reading.wsa);
    const max = knots(reading.wsh);
    const direction = compass(reading.wda);
    return {
      average,
      max,
      direction,
      spoken: `${average} ${max} ${direction}`
    };
  }

  function renderWind(result) {
    resultCard.hidden = false;
    averageEl.textContent = `${result.average} kt`;
    maxEl.textContent = `${result.max} kt`;
    directionEl.textContent = result.direction;
    spokenEl.textContent = result.spoken;
  }

  function runLivewind(event) {
    event.preventDefault();
    log("Fetching wind...");
    logEl.classList.remove("error");

    window.setTimeout(function () {
      try {
        const response = invoke({
          op: "fetch",
          method: "GET",
          url: weatherUrl,
          headers: {
            "Accept": "application/json",
            "wf-tkn": "PUBLIC"
          }
        });

        if (!response.ok) {
          throw new Error(`Fetch failed: HTTP ${response.status}. ${response.body || ""}`.trim());
        }

        const wind = parseWeatherFile(response.body);
        renderWind(wind);
        log(`livewind complete: ${wind.spoken}`);
      } catch (error) {
        log(`Error: ${error.message || error}`);
        logEl.classList.add("error");
      }
    }, 20);
  }

  document.getElementById("livewind-link").addEventListener("click", runLivewind);
}());
