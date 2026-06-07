#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileRunStore } from '../adapters/file-run-store.js'
import { listRecipes } from '../core/recipes.js'
import { defaultRecipesDir, runCommand } from '../index.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  if (!command || command === '--help' || command === 'help') {
    printHelp()
    return
  }

  if (command === 'list') {
    const recipes = await listRecipes(args.recipesDir ?? defaultRecipesDir)
    for (const recipe of recipes) console.log(recipe)
    return
  }

  if (command === 'runs') {
    const runCwd = args.repo ?? process.cwd()
    const store = new FileRunStore(args.storeDir ?? path.join(runCwd, '.commandbook'))
    const keys = await store.list('runs')
    for (const key of keys) console.log(key)
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
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

function printHelp() {
  console.log(`Commandbook

Usage:
  commandbook list
  commandbook runs [--store-dir .commandbook]
  commandbook configure_git_identity --name "Your Name" --email you@example.com --yes
  commandbook git_push_current_branch --yes

Options:
  --repo PATH        Run against a specific git repository
  --store-dir PATH   Store run state somewhere other than .commandbook
  --recipes-dir PATH Load recipes from another folder
  --yes             Approve safe local mutations and final "happy" check
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
}

main().catch((error) => {
  console.error(error.stack ?? error.message)
  process.exitCode = 1
})
