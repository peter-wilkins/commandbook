#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileEventStore, createRuntimeEvent } from '../adapters/event-store.js'
import { FileRunStore } from '../adapters/file-run-store.js'
import { listRecipes, loadRecipe } from '../core/recipes.js'
import { defaultRecipesDir, resumeRunsForEvent, runCommand } from '../index.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  if (!command || command === '--help') {
    printHelp()
    return
  }

  if (command === 'help') {
    const target = args._?.[0]
    if (target) {
      await printCommandHelp(target, args)
    } else {
      printHelp()
    }
    return
  }

  if (command === 'list') {
    await listCommand(args)
    return
  }

  if (command === 'emit') {
    await emitEvent(args)
    return
  }

  if (command === 'runs') {
    await listRuns(args)
    return
  }

  if (command === 'status') {
    await printStatus(args)
    return
  }

  const runCwd = args.repo ?? process.cwd()
  const result = await runCommand({
    command,
    args,
    cwd: runCwd,
    storeRoot: args.storeDir ?? path.join(runCwd, '.commandbook'),
    recipesDir: args.recipesDir ?? path.join(projectRoot, 'recipes')
  })

  printRunSummary(result)
  if (result.status === 'failed') process.exitCode = 1
}

function parseArgs(items) {
  const args = {}
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item.startsWith('--')) {
      args._ = [...(args._ ?? []), item]
      continue
    }

    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    const next = items[i + 1]
    if (!next || next.startsWith('--')) {
      addArg(args, key, true)
    } else {
      addArg(args, key, next)
      i += 1
    }
  }
  return args
}

function addArg(args, key, value) {
  if (args[key] === undefined) {
    args[key] = value
  } else if (Array.isArray(args[key])) {
    args[key].push(value)
  } else {
    args[key] = [args[key], value]
  }
}

async function listCommand(args) {
  const target = args._?.[0] ?? 'commands'

  if (target === 'commands' || target === 'all') {
    const recipesDir = args.recipesDir ?? defaultRecipesDir
    const recipes = await listRecipes(recipesDir)
    for (const name of recipes) {
      const recipe = await loadRecipe(recipesDir, name)
      console.log(`${name} - ${recipe.description ?? 'No description'}`)
    }
    return
  }

  if (target === 'runs') {
    await listRuns(args)
    return
  }

  if (target === 'running') {
    await listRuns(args, { onlyRunning: true })
    return
  }

  if (target === 'events') {
    await listEvents(args)
    return
  }

  throw new Error(`Unknown list target: ${target}`)
}

async function emitEvent(args) {
  const type = args._?.[0]
  if (!type) throw new Error('Usage: commandbook emit <event-type> [--fact key=value]')

  const storeRoot = storeRootFromArgs(args)
  const eventStore = new FileEventStore(storeRoot)
  const event = createRuntimeEvent({
    type,
    facts: parseFacts(args.fact),
    source: args.source ?? 'cli'
  })
  await eventStore.append(event)

  const resumed = await resumeRunsForEvent({
    event,
    cwd: args.repo ?? process.cwd(),
    storeRoot,
    recipesDir: args.recipesDir ?? defaultRecipesDir
  })

  console.log(`event: ${event.type}`)
  console.log(`event_id: ${event.eventId}`)
  console.log(`resumed: ${resumed.length}`)
  for (const ctx of resumed) console.log(`- ${ctx.status} ${ctx.runKey}`)
}

async function listEvents(args) {
  const events = await new FileEventStore(storeRootFromArgs(args)).list()
  for (const event of events) {
    console.log(`${event.at} ${event.type} ${event.eventId}`)
  }
}

async function listRuns(args, { onlyRunning = false } = {}) {
  const store = createStore(args)
  const runs = await loadRuns(store)
  const visible = onlyRunning ? runs.filter(({ ctx }) => isRunningStatus(ctx.status)) : runs
  for (const { key, ctx } of visible) {
    console.log(`${ctx.status.padEnd(16)} ${key}`)
  }
}

async function printStatus(args) {
  const store = createStore(args)
  const runs = await loadRuns(store)
  const target = args._?.[0]
  const selected = target
    ? runs.find(({ key }) => key === target || key.endsWith(`/${target}`))
    : runs.at(-1)

  if (!selected) {
    console.log(target ? `No run found for ${target}` : 'No runs found.')
    return
  }

  printRunSummary(selected.ctx)
}

async function printCommandHelp(command, args) {
  const recipesDir = args.recipesDir ?? defaultRecipesDir
  const recipe = await loadRecipe(recipesDir, command)

  console.log(`${recipe.name ?? command}`)
  console.log(`${recipe.description ?? 'No description.'}`)

  if (recipe.usage) {
    console.log('\nusage:')
    console.log(`  ${recipe.usage}`)
  }

  if (recipe.docs?.length > 0) {
    console.log('\ndocs:')
    for (const doc of recipe.docs) console.log(`  ${doc}`)
  }

  if (!args.long) return

  if (recipe.goal) {
    console.log('\ngoal:')
    console.log(JSON.stringify(recipe.goal, null, 2))
  }

  if (recipe.queue?.length > 0) {
    console.log('\nqueue:')
    for (const item of recipe.queue) console.log(`  - ${item.op}`)
  }
}

function createStore(args) {
  return new FileRunStore(storeRootFromArgs(args))
}

function storeRootFromArgs(args) {
  const runCwd = args.repo ?? process.cwd()
  return args.storeDir ?? path.join(runCwd, '.commandbook')
}

function parseFacts(value) {
  const facts = {}
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value]
  for (const entry of values) {
    const [key, ...rest] = String(entry).split('=')
    if (!key || rest.length === 0) throw new Error(`Invalid fact: ${entry}`)
    facts[key] = parseScalar(rest.join('='))
  }
  return facts
}

function parseScalar(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

async function loadRuns(store) {
  const keys = await store.list('runs')
  const runs = []
  for (const key of keys) {
    const ctx = await store.get(key)
    if (ctx) runs.push({ key, ctx })
  }
  return runs.sort((left, right) => left.ctx.runId.localeCompare(right.ctx.runId))
}

function isRunningStatus(status) {
  return !['complete', 'failed', 'cancelled', 'stopped_cleanly'].includes(status)
}

function printHelp() {
  console.log(`Commandbook

Usage:
  commandbook list [commands|runs|running]
  commandbook list events
  commandbook emit wifi.available --fact network_kind=wifi
  commandbook runs [--store-dir .commandbook]
  commandbook status [run-key]
  commandbook help [command] [--long]
  commandbook configure_git_identity --name "Your Name" --email you@example.com --yes
  commandbook git_push_current_branch --yes

Options:
  --repo PATH        Run against a specific git repository
  --store-dir PATH   Store run state somewhere other than .commandbook
  --recipes-dir PATH Load recipes from another folder
  --yes             Approve safe local mutations and final "happy" check
  --long            Show detailed command help
`)
}

function printRunSummary(ctx) {
  console.log(`status: ${ctx.status}`)
  console.log(`run: ${ctx.runKey}`)

  if (ctx.humanRequirements.length > 0) {
    console.log('\nhuman requirements:')
    for (const requirement of ctx.humanRequirements) {
      console.log(`- ${requirement.title ?? requirement.id}: ${requirement.prompt}`)
      if (requirement.resumeHint) console.log(`  resume: ${requirement.resumeHint}`)
    }
  }

  if (Object.keys(ctx.approvals).length > 0) {
    console.log('\napprovals:')
    for (const [name, approval] of Object.entries(ctx.approvals)) {
      console.log(`- ${name}: ${approval.status}`)
      if (approval.resumeHint) console.log(`  resume: ${approval.resumeHint}`)
    }
  }

  if (ctx.receipts.length > 0) {
    console.log('\nreceipts:')
    for (const receipt of ctx.receipts) {
      console.log(`- ${receipt.op}: ${receipt.result ?? receipt.verified ?? 'ok'}`)
    }
  }

  if (ctx.failures.length > 0) {
    console.log('\nfailures:')
    for (const failure of ctx.failures) {
      console.log(`- ${failure.op}: ${failure.message}`)
    }
  }

  if (ctx.waitingForEvents?.length > 0) {
    console.log('\nwaiting for events:')
    for (const event of ctx.waitingForEvents) {
      console.log(`- ${event.type}: ${event.reason}`)
    }
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message)
  process.exitCode = 1
})
