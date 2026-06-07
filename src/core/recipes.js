import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export async function loadRecipe(recipesDir, command) {
  const recipePath = path.join(recipesDir, `${command}.json`)
  const raw = await readFile(recipePath, 'utf8')
  return JSON.parse(raw)
}

export async function listRecipes(recipesDir) {
  const entries = await readdir(recipesDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''))
    .sort()
}

