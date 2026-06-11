const PAUSED_STATUSES = new Set([
  'paused_for_setup',
  'paused_for_human',
  'paused_for_event',
  'paused_for_approval',
  'failed',
  'cancelled',
  'complete'
])

export async function runContext(initialContext, adapters) {
  let ctx = initialContext
  await checkpoint(ctx, adapters)

  while (ctx.queue.length > 0 && !PAUSED_STATUSES.has(ctx.status)) {
    const [item, ...remainingQueue] = ctx.queue

    ctx = {
      ...ctx,
      status: 'running',
      queue: remainingQueue,
      stack: [...ctx.stack, item],
      inProgress: [{ item, startedAt: adapters.clock().toISOString() }]
    }
    await checkpoint(ctx, adapters)

    const handler = adapters.handlers.get(item.op)
    if (!handler) {
      ctx = fail(ctx, item, new Error(`No operation handler registered for ${item.op}`), adapters)
      break
    }

    try {
      ctx = await handler(ctx, item, adapters)
      if (PAUSED_STATUSES.has(ctx.status)) {
        ctx = {
          ...ctx,
          queue: queueStartsWith(ctx.queue, item) ? ctx.queue : [item, ...ctx.queue],
          stack: ctx.stack.slice(0, -1),
          inProgress: []
        }
        await checkpoint(ctx, adapters)
        break
      }

      ctx = {
        ...ctx,
        completed: [
          ...ctx.completed,
          { op: item.op, phase: item.phase ?? 'enter', at: adapters.clock().toISOString() }
        ],
        stack: ctx.stack.slice(0, -1),
        inProgress: []
      }
      await checkpoint(ctx, adapters)
    } catch (error) {
      ctx = fail(ctx, item, error, adapters)
      break
    }
  }

  if (ctx.queue.length === 0 && !PAUSED_STATUSES.has(ctx.status)) {
    ctx = { ...ctx, status: 'complete' }
  }

  await checkpoint(ctx, adapters)
  return ctx
}

function queueStartsWith(queue, item) {
  const [first] = queue
  return first && first.op === item.op && (first.phase ?? 'enter') === (item.phase ?? 'enter')
}

async function checkpoint(ctx, adapters) {
  await adapters.store.put(ctx.runKey, ctx)
}

function fail(ctx, item, error, adapters) {
  const failure = {
    op: item.op,
    message: error.message,
    code: error.code,
    stdout: error.stdout,
    stderr: error.stderr,
    at: adapters.clock().toISOString()
  }

  return {
    ...ctx,
    status: 'failed',
    failures: [...ctx.failures, failure],
    inProgress: []
  }
}
