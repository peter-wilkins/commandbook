import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileRunStore } from './adapters/file-run-store.js'
import { runShell } from './adapters/shell.js'
import { createRunContext } from './core/context.js'
import { loadRecipe } from './core/recipes.js'
import { runContext } from './core/runner.js'
import { createBlogHandlers } from './operations/blog.js'
import { createGitHandlers } from './operations/git.js'
import { createSimulationHandlers } from './operations/simulation.js'
export {
  PlatformRuntimeAdapterDescriptorSchema,
  PlatformRuntimeCapabilitiesSchema,
  assertPlatformRuntimeAdapter
} from './core/platform-runtime-adapter.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const defaultRecipesDir = path.join(projectRoot, 'recipes')

export async function runCommand({
  command,
  args = {},
  cwd = process.cwd(),
  storeRoot = path.join(cwd, '.commandbook'),
  recipesDir = defaultRecipesDir,
  now = () => new Date(),
  shell = runShell
}) {
  const recipe = await loadRecipe(recipesDir, command)
  const store = new FileRunStore(storeRoot)
  const handlers = createHandlers()

  const adapters = createAdapters({ cwd, store, handlers, shell, now, recipesDir })

  const ctx = createRunContext({
    command,
    recipe,
    args,
    now: now()
  })

  return runContext(ctx, adapters)
}

export async function resumeRunsForEvent({
  event,
  cwd = process.cwd(),
  storeRoot = path.join(cwd, '.commandbook'),
  recipesDir = defaultRecipesDir,
  now = () => new Date(),
  shell = runShell
}) {
  const store = new FileRunStore(storeRoot)
  const handlers = createHandlers()
  const adapters = createAdapters({ cwd, store, handlers, shell, now, recipesDir })
  const keys = await store.list('runs')
  const resumed = []

  for (const key of keys) {
    const ctx = await store.get(key)
    if (!shouldResumeForEvent(ctx, event)) continue

    const result = await runContext(applyEventToRun(ctx, event), adapters)
    resumed.push(result)
  }

  return resumed
}

function createHandlers() {
  return new Map([
    ...createBlogHandlers(),
    ...createGitHandlers(),
    ...createSimulationHandlers()
  ])
}

function createAdapters({ cwd, store, handlers, shell, now, recipesDir }) {
  return {
    cwd,
    store,
    handlers,
    shell,
    clock: now,
    projectRoot: path.resolve(recipesDir, '..'),
    async loadRecipe(name) {
      return loadRecipe(recipesDir, name)
    }
  }
}

function shouldResumeForEvent(ctx, event) {
  if (!ctx || ctx.status !== 'paused_for_event') return false
  if (ctx.eventSummary?.consumedEventIds?.includes(event.eventId)) return false
  return (ctx.waitingForEvents ?? []).some((waiting) => waiting.type === event.type)
}

function applyEventToRun(ctx, event) {
  const recentEvents = [...(ctx.recentEvents ?? []), event].slice(-10)
  const consumedEventIds = [
    ...(ctx.eventSummary?.consumedEventIds ?? []),
    event.eventId
  ].slice(-50)

  return {
    ...ctx,
    status: 'running',
    waitingForEvents: (ctx.waitingForEvents ?? []).filter((waiting) => waiting.type !== event.type),
    facts: {
      ...ctx.facts,
      lastRuntimeEvent: event,
      networkAvailable: isNetworkAvailableEvent(event) ? true : ctx.facts.networkAvailable
    },
    eventSummary: {
      receivedCount: (ctx.eventSummary?.receivedCount ?? 0) + 1,
      lastEventId: event.eventId,
      lastMatchingEvent: {
        type: event.type,
        at: event.at
      },
      consumedEventIds
    },
    recentEvents
  }
}

function isNetworkAvailableEvent(event) {
  return event.type === 'wifi.available' || event.type === 'network.available'
}
