(function () {
  const commandIndexUrl = "https://raw.githubusercontent.com/peter-wilkins/commandbook/main/command-index.json";

  const commandListEl = document.getElementById("command-list");
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

  async function loadJson(path, fallbackUrl) {
    const hasNativeBridge = window.FieldRelayNative && typeof window.FieldRelayNative.invoke === "function";
    if (hasNativeBridge) {
      const runtimeAsset = invoke({
        op: "read_runtime_asset",
        path: path.replace(/^\.\//, "")
      });
      if (runtimeAsset.ok) return JSON.parse(runtimeAsset.body);

      const response = invoke({
        op: "fetch",
        method: "GET",
        url: fallbackUrl,
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) {
        throw new Error(`Fetch failed: HTTP ${response.status}. ${response.body || ""}`.trim());
      }
      return JSON.parse(response.body);
    }

    try {
      const local = await fetch(path, { cache: "no-store" });
      if (local.ok) return local.json();
    } catch (_) {
      // Fall through to the public URL when running outside the Android shell.
    }

    const response = await fetch(fallbackUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Fetch failed: HTTP ${response.status}`);
    }
    return response.json();
  }

  async function loadCommandIndex() {
    return loadJson("./command-index.json", commandIndexUrl);
  }

  async function loadRecipe(commandIndex, command) {
    const recipeUrl = `${commandIndex.rawBaseUrl.replace(/\/$/, "")}/${command.recipePath}`;
    return loadJson(`./${command.recipePath.split("/").pop()}`, recipeUrl);
  }

  function audioName(name) {
    return name.replace(/_/g, "");
  }

  function renderCommands(commandIndex) {
    commandListEl.innerHTML = "";
    commandIndex.commands.forEach((command) => {
      const row = document.createElement("div");
      row.className = "command-row";
      row.addEventListener("click", (event) => runCommand(event, commandIndex, command));

      const link = document.createElement("a");
      link.href = `#${audioName(command.name)}`;
      link.textContent = audioName(command.name);
      link.className = "command-link";
      link.addEventListener("click", (event) => {
        event.stopPropagation();
        runCommand(event, commandIndex, command);
      });

      const description = document.createElement("p");
      description.textContent = command.description;

      const rawName = document.createElement("p");
      rawName.className = "muted";
      rawName.textContent = command.name;

      row.append(link, description, rawName);
      commandListEl.append(row);
    });
  }

  function renderWind(result) {
    resultCard.hidden = false;
    averageEl.textContent = `${result.average} kt`;
    maxEl.textContent = `${result.max} kt`;
    directionEl.textContent = result.direction;
    spokenEl.textContent = result.spoken;
    resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderGenericResult(commandName, result) {
    resultCard.hidden = true;
    log(`${audioName(commandName)} complete: ${JSON.stringify(result.facts)}`);
    logEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function runCommand(event, commandIndex, command) {
    event.preventDefault();
    log(`Running ${audioName(command.name)}...`);
    logEl.classList.remove("error");

    window.setTimeout(async function () {
      try {
        const grinder = window.CommandbookCoffeeGrinder;
        if (!grinder) {
          throw new Error("Coffee Grinder runtime is not loaded.");
        }

        const recipe = await loadRecipe(commandIndex, command);
        const ctx = grinder.createRunContext({
          command: command.name,
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

        if (result.facts.liveWind) {
          renderWind(result.facts.liveWind);
          log(`coffee grinder complete: ${result.facts.liveWind.spoken}`);
        } else {
          renderGenericResult(command.name, result);
        }
      } catch (error) {
        log(`Error: ${error.message || error}`);
        logEl.classList.add("error");
      }
    }, 20);
  }

  async function init() {
    try {
      log("Loading Commandbook commands...");
      const commandIndex = await loadCommandIndex();
      renderCommands(commandIndex);
      log(`Loaded ${commandIndex.commands.length} commands.`);
    } catch (error) {
      commandListEl.textContent = "Command list unavailable.";
      log(`Error: ${error.message || error}`);
      logEl.classList.add("error");
    }
  }

  init();
}());
