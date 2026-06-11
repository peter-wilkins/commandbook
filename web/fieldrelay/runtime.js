(function () {
  const commandIndexUrl = "https://raw.githubusercontent.com/peter-wilkins/commandbook/main/command-index.json";
  const commandbookHeadUrl = "https://api.github.com/repos/peter-wilkins/commandbook/commits/main";
  const pinnedCommandKeys = ["livewind", "deepwater"];
  const readOnlyCommandKeys = new Set(["livewind", "deepwater"]);
  const usageStorageKey = "fieldrelay.browserlab.usage.v1";

  const pinnedListEl = document.getElementById("pinned-command-list");
  const commandListEl = document.getElementById("command-list");
  const statusLineEl = document.getElementById("status-line");
  const openConversationEl = document.getElementById("open-conversation");
  let queuedRunKey = commandKey(new URLSearchParams(window.location.search).get("run") || "");
  const resultCard = document.getElementById("result-card");
  const resultLabels = [
    document.getElementById("result-primary-label"),
    document.getElementById("result-secondary-label"),
    document.getElementById("result-tertiary-label"),
    document.getElementById("result-summary-label")
  ];
  const resultValues = [
    document.getElementById("result-primary-value") || document.getElementById("wind-average"),
    document.getElementById("result-secondary-value") || document.getElementById("wind-max"),
    document.getElementById("result-tertiary-value") || document.getElementById("wind-direction"),
    document.getElementById("result-summary-value") || document.getElementById("wind-spoken")
  ];

  let commandIndexState = null;
  let statusVersion = 0;

  function setStatus(message, isError) {
    statusVersion += 1;
    statusLineEl.textContent = message;
    statusLineEl.classList.toggle("error", Boolean(isError));
    return statusVersion;
  }

  function setStatusIfCurrent(version, message, isError) {
    if (version !== statusVersion) return;
    setStatus(message, isError);
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

  async function loadGitHubHead() {
    const hasNativeBridge = window.FieldRelayNative && typeof window.FieldRelayNative.invoke === "function";
    if (hasNativeBridge) {
      const response = invoke({
        op: "fetch",
        method: "GET",
        url: commandbookHeadUrl,
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": "FieldRelay"
        }
      });
      if (!response.ok) {
        throw new Error(`Fetch failed: HTTP ${response.status}. ${response.body || ""}`.trim());
      }
      return JSON.parse(response.body);
    }

    const response = await fetch(commandbookHeadUrl, {
      cache: "no-store",
      headers: { "Accept": "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);
    return response.json();
  }

  async function loadRecipe(commandIndex, command) {
    const recipeUrl = `${commandIndex.rawBaseUrl.replace(/\/$/, "")}/${command.recipePath}`;
    return loadJson(`./${command.recipePath.split("/").pop()}`, recipeUrl);
  }

  function commandKey(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function displayName(name) {
    const key = commandKey(name);
    if (key === "livewind") return "Live wind";
    if (key === "deepwater") return "Deep water";
    return String(name || "").replace(/_/g, " ");
  }

  function shortHash(value) {
    return String(value || "").slice(0, 7);
  }

  function commandbookFallbackStatus(commandIndex) {
    return commandIndex.indexHash
      ? `Commandbook index ${shortHash(commandIndex.indexHash)}`
      : "Commandbook ready";
  }

  async function updateCommandbookGitStatus(commandIndex, version) {
    try {
      const head = await loadGitHubHead();
      const sha = shortHash(head.sha);
      if (sha) {
        setStatusIfCurrent(version, `Commandbook main ${sha}`);
      }
    } catch (_) {
      setStatusIfCurrent(version, commandbookFallbackStatus(commandIndex));
    }
  }

  function loadUsage() {
    try {
      return JSON.parse(window.localStorage.getItem(usageStorageKey) || "{}");
    } catch (_) {
      return {};
    }
  }

  function incrementUsage(command) {
    const usage = loadUsage();
    const key = commandKey(command.name);
    usage[key] = (usage[key] || 0) + 1;
    window.localStorage.setItem(usageStorageKey, JSON.stringify(usage));
    try {
      invoke({
        op: "record_command_usage",
        name: command.name
      });
    } catch (_) {
      // Browser localStorage remains the fallback outside the Android shell.
    }
  }

  function renderCommands(commandIndex) {
    commandIndexState = commandIndex;
    const commands = commandIndex.commands || [];
    const usage = loadUsage();
    const pinned = pinnedCommandKeys
      .map((key) => commands.find((command) => commandKey(command.name) === key))
      .filter(Boolean);
    const pinnedSet = new Set(pinned.map((command) => commandKey(command.name)));
    const frequent = commands
      .filter((command) => !pinnedSet.has(commandKey(command.name)))
      .sort((a, b) => (usage[commandKey(b.name)] || 0) - (usage[commandKey(a.name)] || 0));

    renderCommandList(pinnedListEl, pinned, "No pinned commands found.");
    renderCommandList(commandListEl, frequent, "No other commands found.");
  }

  function findCommandByKey(commandIndex, key) {
    return (commandIndex.commands || []).find((command) => commandKey(command.name) === key);
  }

  function renderCommandList(targetEl, commands, emptyText) {
    targetEl.innerHTML = "";
    if (!commands.length) {
      targetEl.textContent = emptyText;
      return;
    }

    commands.forEach((command) => {
      const row = document.createElement("div");
      row.className = "command-row";
      row.addEventListener("click", (event) => handleCommandClick(event, command));

      const link = document.createElement("a");
      link.href = `#${commandKey(command.name)}`;
      link.textContent = displayName(command.name);
      link.className = "command-link";
      link.addEventListener("click", (event) => {
        event.stopPropagation();
        handleCommandClick(event, command);
      });

      const description = document.createElement("p");
      description.textContent = command.description;

      const rawName = document.createElement("p");
      rawName.className = "muted";
      rawName.textContent = readOnlyCommandKeys.has(commandKey(command.name))
        ? "Read-only. Runs immediately."
        : "Dry run first.";

      row.append(link, description, rawName);
      targetEl.append(row);
    });
  }

  function handleCommandClick(event, command) {
    event.preventDefault();
    const key = commandKey(command.name);
    incrementUsage(command);
    renderCommands(commandIndexState);
    if (readOnlyCommandKeys.has(key)) {
      runCommand(commandIndexState, command);
      return;
    }
    renderDryRun(command);
  }

  function runQueuedCommand() {
    if (!queuedRunKey || !commandIndexState) return;
    const key = queuedRunKey;
    queuedRunKey = "";
    const command = findCommandByKey(commandIndexState, key);
    if (!command) {
      setStatus(`Unknown command: ${key}`, true);
      return;
    }
    if (!readOnlyCommandKeys.has(commandKey(command.name))) {
      renderDryRun(command);
      return;
    }
    incrementUsage(command);
    renderCommands(commandIndexState);
    runCommand(commandIndexState, command);
  }

  window.FieldRelayRunCommand = function (commandName) {
    queuedRunKey = commandKey(commandName);
    runQueuedCommand();
  };

  function renderWind(result) {
    renderResult([
      ["AVERAGE", `${result.average} kt`],
      ["MAX", `${result.max} kt`],
      ["DIRECTION", result.direction],
      ["SPOKEN", result.spoken]
    ]);
  }

  function renderDeepWater(result) {
    renderResult([
      ["STATUS", result.isDeepNow ? "DEEP NOW" : "GUIDE"],
      ["WINDOWS", result.summary],
      ["THRESHOLD", `${result.thresholdMeters} m`],
      ["DATE", result.sourceDate]
    ]);
  }

  function renderResult(rows) {
    resultCard.hidden = false;
    rows.forEach(([label, value], index) => {
      if (resultLabels[index]) resultLabels[index].textContent = label;
      if (resultValues[index]) resultValues[index].textContent = value;
    });
    resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderDryRun(command) {
    renderResult([
      ["COMMAND", displayName(command.name)],
      ["SUMMARY", command.description || "No summary."],
      ["INPUTS", command.usage || "Not specified."],
      ["PERMISSION", "Not read-only. Dry run only."]
    ]);
    setStatus(`${displayName(command.name)} was not run.`);
  }

  function renderGenericResult(commandName, result) {
    resultCard.hidden = true;
    setStatus(`${displayName(commandName)} complete: ${JSON.stringify(result.facts)}`);
  }

  function runCommand(commandIndex, command) {
    if (!commandIndex || !command) return;
    setStatus(`Running ${displayName(command.name)}...`);

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
          setStatus(result.facts.liveWind.spoken);
        } else if (result.facts.deepWater) {
          renderDeepWater(result.facts.deepWater);
          setStatus(result.facts.deepWater.summary);
        } else {
          renderGenericResult(command.name, result);
        }
      } catch (error) {
        setStatus(`Error: ${error.message || error}`, true);
      }
    }, 20);
  }

  function openConversation(text) {
    try {
      const response = invoke({
        op: "open_conversation",
        text
      });
      if (!response.ok) throw new Error(response.body || response.error || "Conversation opener failed.");
    } catch (error) {
      setStatus(`Could not open Field Relay Lab: ${error.message || error}`, true);
    }
  }

  function bindChrome() {
    openConversationEl.addEventListener("click", () => openConversation(""));
  }

  async function init() {
    bindChrome();
    try {
      setStatus("Loading Commandbook commands...");
      const commandIndex = await loadCommandIndex();
      renderCommands(commandIndex);
      const versionStatus = setStatus(commandbookFallbackStatus(commandIndex));
      if (!queuedRunKey) updateCommandbookGitStatus(commandIndex, versionStatus);
      runQueuedCommand();
    } catch (error) {
      pinnedListEl.textContent = "Pinned commands unavailable.";
      commandListEl.textContent = "Command list unavailable.";
      setStatus(`Error: ${error.message || error}`, true);
    }
  }

  init();
}());
