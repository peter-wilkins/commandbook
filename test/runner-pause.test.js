import assert from 'node:assert/strict'
import test from 'node:test'
import { runContext } from '../src/core/runner.js'

test('paused operations stay queued for verification after human action', async () => {
  const item = { op: 'needs_human', phase: 'enter' }
  const ctx = await runContext(baseContext({ queue: [item] }), adaptersWith([
    ['needs_human', async (ctx) => ({
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [{ id: 'toggle_setting', prompt: 'Turn setting on.' }]
    })]
  ]))

  assert.equal(ctx.status, 'paused_for_human')
  assert.deepEqual(ctx.completed, [])
  assert.deepEqual(ctx.queue, [item])
  assert.deepEqual(ctx.inProgress, [])
})

test('paused operations are not duplicated when a handler already requeues itself', async () => {
  const item = { op: 'wait_for_wifi', phase: 'enter' }
  const ctx = await runContext(baseContext({ queue: [item] }), adaptersWith([
    ['wait_for_wifi', async (ctx, item) => ({
      ...ctx,
      status: 'paused_for_event',
      waitingForEvents: [{ type: 'wifi.available' }],
      queue: [item, ...ctx.queue]
    })]
  ]))

  assert.equal(ctx.status, 'paused_for_event')
  assert.deepEqual(ctx.queue, [item])
})

function baseContext({ queue }) {
  return {
    runId: 'run-test',
    runKey: 'runs/example/run-test.json',
    command: 'example',
    status: 'running',
    facts: {},
    goal: {},
    queue,
    stack: [],
    completed: [],
    inProgress: [],
    humanRequirements: [],
    approvals: {},
    receipts: [],
    failures: []
  }
}

function adaptersWith(handlers) {
  const stored = new Map()
  return {
    handlers: new Map(handlers),
    clock: () => new Date('2026-06-11T10:00:00.000Z'),
    store: {
      async put(key, value) {
        stored.set(key, value)
      }
    }
  }
}
