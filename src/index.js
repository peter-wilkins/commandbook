import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileRunStore } from './adapters/file-run-store.js'
import { runShell } from './adapters/shell.js'
import { createRunContext } from './core/context.js'
import { loadRecipe } from './core/recipes.js'
import { runContext } from './core/runner.js'
import { createGitHandlers } from './operations/git.js'

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
  const handlers = createGitHandlers()

  const adapters = {
    cwd,
    store,
    handlers,
    shell,
    clock: now,
    async loadRecipe(name) {
      return loadRecipe(recipesDir, name)
    }
  }

  const ctx = createRunContext({
    command,
    recipe,
    args,
    now: now()
  })

  return runContext(ctx, adapters)
}

