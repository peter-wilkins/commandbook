(function () {
  const pausedStatuses = new Set([
    "paused_for_setup",
    "paused_for_human",
    "paused_for_event",
    "paused_for_approval",
    "failed",
    "cancelled",
    "complete"
  ]);

  function createRunContext({ command, recipe, args = {}, runId, now = new Date() }) {
    const id = runId || createRunId(now);
    return {
      runId: id,
      runKey: `runs/${command}/${id}.json`,
      command,
      status: "running",
      facts: {
        commandArgs: args,
        autoApprove: Boolean(args.yes),
        scope: args.scope || recipe.defaultScope || "field_relay_webview"
      },
      goal: recipe.goal || {},
      queue: (recipe.queue || []).map((item) => ({ phase: "enter", ...item })),
      stack: [],
      completed: [],
      inProgress: [],
      humanRequirements: [],
      approvals: {},
      receipts: [],
      failures: []
    };
  }

  async function runContext(initialContext, adapters) {
    let ctx = initialContext;
    await checkpoint(ctx, adapters);

    while (ctx.queue.length > 0 && !pausedStatuses.has(ctx.status)) {
      const [item, ...remainingQueue] = ctx.queue;
      ctx = {
        ...ctx,
        status: "running",
        queue: remainingQueue,
        stack: [...ctx.stack, item],
        inProgress: [{ item, startedAt: adapters.clock().toISOString() }]
      };
      await checkpoint(ctx, adapters);

      const handler = adapters.handlers.get(item.op);
      if (!handler) {
        ctx = fail(ctx, item, new Error(`No operation handler registered for ${item.op}`), adapters);
        break;
      }

      try {
        ctx = await handler(ctx, item, adapters);
        if (pausedStatuses.has(ctx.status)) {
          ctx = {
            ...ctx,
            queue: queueStartsWith(ctx.queue, item) ? ctx.queue : [item, ...ctx.queue],
            stack: ctx.stack.slice(0, -1),
            inProgress: []
          };
          await checkpoint(ctx, adapters);
          break;
        }

        ctx = {
          ...ctx,
          completed: [
            ...ctx.completed,
            { op: item.op, phase: item.phase || "enter", at: adapters.clock().toISOString() }
          ],
          stack: ctx.stack.slice(0, -1),
          inProgress: []
        };
        await checkpoint(ctx, adapters);
      } catch (error) {
        ctx = fail(ctx, item, error, adapters);
        break;
      }
    }

    if (ctx.queue.length === 0 && !pausedStatuses.has(ctx.status)) {
      ctx = { ...ctx, status: "complete" };
    }

    await checkpoint(ctx, adapters);
    return ctx;
  }

  function createMemoryRunStore() {
    const records = new Map();
    return {
      async put(key, value) {
        records.set(key, clone(value));
      },
      async get(key) {
        return clone(records.get(key));
      },
      async list(prefix = "") {
        return [...records.keys()].filter((key) => key.startsWith(prefix));
      },
      snapshot() {
        return Object.fromEntries(records.entries());
      }
    };
  }

  function createFieldRelayAdapters({ invoke, now = () => new Date() }) {
    return {
      store: createMemoryRunStore(),
      clock: now,
      invoke,
      handlers: new Map([
        ["fetch", fetchHandler],
        ["fetch_text", fetchTextHandler],
        ["fetch_json", fetchJsonHandler],
        ["extract_weatherfile_live_wind", extractWeatherfileLiveWindHandler],
        ["extract_deepwater_windows", extractDeepwaterWindowsHandler]
      ])
    };
  }

  async function fetchHandler(ctx, item, adapters) {
    const args = { ...(item.defaults || {}), ...(ctx.facts.commandArgs || {}) };
    const response = adapters.invoke({
      op: "fetch",
      method: item.method || "GET",
      url: template(item.url, args),
      headers: item.headers || {},
      body: item.body
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: HTTP ${response.status}. ${response.body || ""}`.trim());
    }

    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        [item.outputFact]: response
      }
    };
  }

  async function fetchJsonHandler(ctx, item, adapters) {
    const ctxWithResponse = await fetchHandler(
      { ...ctx, facts: { ...ctx.facts } },
      { ...item, outputFact: `${item.outputFact}Response` },
      adapters
    );
    const response = ctxWithResponse.facts[`${item.outputFact}Response`];
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        [item.outputFact]: JSON.parse(response.body)
      }
    };
  }

  async function fetchTextHandler(ctx, item, adapters) {
    const ctxWithResponse = await fetchHandler(
      { ...ctx, facts: { ...ctx.facts } },
      { ...item, outputFact: `${item.outputFact}Response` },
      adapters
    );
    const response = ctxWithResponse.facts[`${item.outputFact}Response`];
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        [item.outputFact]: response.body
      }
    };
  }

  async function extractWeatherfileLiveWindHandler(ctx, item) {
    const source = ctx.facts[item.sourceFact];
    if (!source) throw new Error(`Missing weather fact: ${item.sourceFact}`);
    const payload = typeof source.body === "string" ? JSON.parse(source.body) : source;
    const reading = payload && payload.data && payload.data.lastaverage;
    if (!reading) {
      throw new Error("WeatherFile response did not include data.lastaverage.");
    }

    const average = knots(reading.wsa);
    const max = knots(reading.wsh);
    const direction = compass(reading.wda);
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        [item.outputFact]: {
          average,
          max,
          direction,
          spoken: `${average} ${max} ${direction}`
        }
      }
    };
  }

  function queueStartsWith(queue, item) {
    const first = queue[0];
    return first && first.op === item.op && (first.phase || "enter") === (item.phase || "enter");
  }

  async function checkpoint(ctx, adapters) {
    await adapters.store.put(ctx.runKey, ctx);
  }

  function fail(ctx, item, error, adapters) {
    return {
      ...ctx,
      status: "failed",
      failures: [
        ...ctx.failures,
        {
          op: item.op,
          message: error.message,
          at: adapters.clock().toISOString()
        }
      ],
      inProgress: []
    };
  }

  function createRunId(now) {
    const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${stamp}-${random}`;
  }

  function template(value, args) {
    return String(value).replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key) => {
      if (Object.prototype.hasOwnProperty.call(args, key)) return args[key];
      throw new Error(`Missing template argument: ${key}`);
    });
  }

  function knots(value) {
    return Math.round(Number(value) * 1.9438444924406);
  }

  function compass(degrees) {
    const points = [
      "N", "NNE", "NE", "ENE",
      "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW",
      "W", "WNW", "NW", "NNW"
    ];
    const normalised = ((Number(degrees) % 360) + 360) % 360;
    return points[Math.round(normalised / 22.5) % 16];
  }

  async function extractDeepwaterWindowsHandler(ctx, item) {
    const html = ctx.facts[item.sourceFact];
    if (typeof html !== "string") throw new Error(`Missing TideTimes HTML fact: ${item.sourceFact}`);

    const args = { ...(item.defaults || {}), ...(ctx.facts.commandArgs || {}) };
    const prediction = parseTideTimesPage(html);
    const clipStart = chooseClipStart(prediction, args);
    const windows = calculateDeepwaterWindows({
      events: prediction.events,
      thresholdMeters: Number(args.thresholdMeters || 0.9),
      clipStartMinutes: clipStart,
      roundMinutes: Number(args.roundMinutes || 20),
      maxStartBeforeHighMinutes: Number(args.maxStartBeforeHighMinutes || 165),
      maxEndAfterHighMinutes: Number(args.maxEndAfterHighMinutes || 190)
    });
    const summary = windows.length === 0
      ? "not deep enough today"
      : windows.map((window) => `${window.start.replace(":", ".")} till ${window.end.replace(":", ".")}`).join(" and ");
    const nowMinutes = prediction.serverTimeMinutes;
    const isDeepNow = prediction.pageDate === prediction.serverDate && windows.some((window) => (
      nowMinutes >= window.startMinutes && nowMinutes <= window.endMinutes
    ));

    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        [item.outputFact]: {
          summary,
          windows,
          isDeepNow,
          thresholdMeters: Number(args.thresholdMeters || 0.9),
          sourceDate: prediction.pageDate,
          locationName: prediction.locationName,
          tideEvents: prediction.events
        }
      }
    };
  }

  function parseTideTimesPage(html) {
    const locationName = textMatch(html, /<h1>(.*?)\s+Tide Times<\/h1>/i) || "Unknown";
    const pageDate = dateFromCompact(textMatch(html, /\/dates-(\d{8})-\d+/i));
    const server = parseServerTime(html);
    const events = [...html.matchAll(
      /<tr class="vis2">[\s\S]*?<td class="tal">(High|Low)<\/td>[\s\S]*?<span>(\d{2}:\d{2})<\/span>[\s\S]*?<td class="tar">([0-9.]+)m<\/td>[\s\S]*?<\/tr>/gi
    )].map((match) => ({
      type: match[1],
      time: match[2],
      minutes: timeToMinutes(match[2]),
      heightMeters: Number(match[3])
    }));

    if (!pageDate) throw new Error("TideTimes page date was not found");
    if (events.length < 2) throw new Error("TideTimes page did not contain enough visible tide events");
    return {
      locationName: decodeHtml(locationName),
      pageDate,
      serverDate: server && server.date,
      serverTimeMinutes: server && server.minutes,
      events
    };
  }

  function calculateDeepwaterWindows({
    events,
    thresholdMeters,
    clipStartMinutes,
    roundMinutes,
    maxStartBeforeHighMinutes,
    maxEndAfterHighMinutes
  }) {
    const windows = [];
    let activeStart = events[0].heightMeters >= thresholdMeters ? clipStartMinutes : null;

    for (let index = 0; index < events.length - 1; index += 1) {
      const from = events[index];
      const to = events[index + 1];
      const fromDeep = from.heightMeters >= thresholdMeters;
      const toDeep = to.heightMeters >= thresholdMeters;

      if (!fromDeep && toDeep) {
        const crossing = crossingMinutes(from, to, thresholdMeters);
        const practicalStart = to.type === "High"
          ? Math.max(crossing, to.minutes - maxStartBeforeHighMinutes)
          : crossing;
        activeStart = Math.max(practicalStart, clipStartMinutes);
      } else if (fromDeep && !toDeep) {
        const crossing = crossingMinutes(from, to, thresholdMeters);
        const practicalEnd = from.type === "High"
          ? Math.min(crossing, from.minutes + maxEndAfterHighMinutes)
          : crossing;
        pushWindow(windows, activeStart ?? clipStartMinutes, practicalEnd, roundMinutes);
        activeStart = null;
      } else if (fromDeep && toDeep && activeStart === null) {
        activeStart = Math.max(from.minutes, clipStartMinutes);
      }
    }

    const last = events[events.length - 1];
    if (activeStart !== null && last.heightMeters >= thresholdMeters) {
      pushWindow(windows, activeStart, 24 * 60, roundMinutes);
    }

    return mergeTouching(windows);
  }

  function chooseClipStart(prediction, args) {
    if (args.fromTime) return timeToMinutes(String(args.fromTime));
    if (prediction.pageDate && prediction.pageDate === prediction.serverDate && prediction.serverTimeMinutes != null) {
      return prediction.serverTimeMinutes;
    }
    return timeToMinutes(String(args.dayStart || "06:00"));
  }

  function pushWindow(windows, rawStart, rawEnd, roundMinutes) {
    const clippedStart = Math.max(0, Math.min(24 * 60, rawStart));
    const clippedEnd = Math.max(0, Math.min(24 * 60, rawEnd));
    if (clippedEnd <= clippedStart) return;
    const startMinutes = roundUp(clippedStart, roundMinutes);
    const endMinutes = roundUp(clippedEnd, roundMinutes);
    if (endMinutes <= startMinutes) return;
    windows.push({
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
      startMinutes,
      endMinutes
    });
  }

  function mergeTouching(windows) {
    return windows.reduce((merged, window) => {
      const previous = merged[merged.length - 1];
      if (previous && previous.endMinutes >= window.startMinutes) {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = minutesToTime(previous.endMinutes);
      } else {
        merged.push({ ...window });
      }
      return merged;
    }, []);
  }

  function crossingMinutes(from, to, thresholdMeters) {
    const heightRange = to.heightMeters - from.heightMeters;
    if (heightRange === 0) return to.minutes;
    const fraction = (thresholdMeters - from.heightMeters) / heightRange;
    return from.minutes + fraction * (to.minutes - from.minutes);
  }

  function parseServerTime(html) {
    const match = html.match(/timeServer\s*=\s*new Date\((\d{4}),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) + 1;
    const day = Number(match[3]);
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      minutes: Number(match[4]) * 60 + Number(match[5])
    };
  }

  function dateFromCompact(value) {
    if (!value) return null;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  function textMatch(text, regex) {
    const match = text.match(regex);
    return match && match[1] && match[1].trim();
  }

  function timeToMinutes(value) {
    const match = String(value).match(/^(\d{1,2}):?(\d{2})$/);
    if (!match) throw new Error(`Invalid time: ${value}`);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function minutesToTime(value) {
    const minutes = Math.max(0, Math.min(24 * 60, Math.round(value)));
    if (minutes === 24 * 60) return "24:00";
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function roundUp(value, step) {
    return Math.ceil(value / step) * step;
  }

  function decodeHtml(value) {
    return String(value)
      .replace(/&amp;/g, "&")
      .replace(/&pound;/g, "£")
      .replace(/&quot;/g, "\"")
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  window.CommandbookCoffeeGrinder = {
    createRunContext,
    runContext,
    createMemoryRunStore,
    createFieldRelayAdapters
  };
}());
