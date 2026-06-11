(function () {
  const weatherUrl = "https://weatherfile.com/V03/loc/GBR00005/infowindow.ggl";

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

    window.setTimeout(async function () {
      try {
        const grinder = window.CommandbookCoffeeGrinder;
        if (!grinder) {
          throw new Error("Coffee Grinder runtime is not loaded.");
        }

        const recipe = {
          queue: [
            {
              op: "fetch",
              method: "GET",
              url: weatherUrl,
              headers: {
                "Accept": "application/json",
                "wf-tkn": "PUBLIC"
              },
              outputFact: "weatherfileResponse"
            },
            {
              op: "extract_weatherfile_live_wind",
              sourceFact: "weatherfileResponse",
              outputFact: "liveWind"
            }
          ]
        };
        const ctx = grinder.createRunContext({
          command: "livewind",
          recipe,
          args: {},
          now: new Date()
        });
        const result = await grinder.runContext(
          ctx,
          grinder.createFieldRelayAdapters({ invoke })
        );
        if (result.status !== "complete") {
          throw new Error(result.failures[0]?.message || `Run ended with status ${result.status}`);
        }

        const wind = result.facts.liveWind;
        renderWind(wind);
        log(`coffee grinder complete: ${wind.spoken}`);
      } catch (error) {
        log(`Error: ${error.message || error}`);
        logEl.classList.add("error");
      }
    }, 20);
  }

  document.getElementById("livewind-link").addEventListener("click", runLivewind);
}());
