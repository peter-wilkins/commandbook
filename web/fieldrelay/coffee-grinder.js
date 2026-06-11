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
        ["fetch_json", fetchJsonHandler],
        ["extract_weatherfile_live_wind", extractWeatherfileLiveWindHandler]
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
