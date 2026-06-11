#!/usr/bin/env node
import crypto from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recipesDir = path.join(projectRoot, 'recipes')
const outputPath = path.join(projectRoot, 'command-index.json')

export async function buildCommandIndex({ root = projectRoot } = {}) {
  const recipeRoot = path.join(root, 'recipes')
  const files = (await readdir(recipeRoot)).filter((name) => name.endsWith('.json')).sort()
  const commands = []

  for (const fileName of files) {
    const recipePath = path.join(recipeRoot, fileName)
    const raw = await readFile(recipePath, 'utf8')
    const recipe = JSON.parse(raw)
    commands.push({
      name: recipe.name ?? path.basename(fileName, '.json'),
      description: recipe.description ?? '',
      usage: recipe.usage ?? '',
      defaultScope: recipe.defaultScope ?? '',
      docs: Array.isArray(recipe.docs) ? recipe.docs : [],
      recipePath: `recipes/${fileName}`,
      sha256: sha256(raw)
    })
  }

  const withoutHash = {
    schema: 'commandbook.command_index.v1',
    source: 'github.com/peter-wilkins/commandbook',
    rawBaseUrl: 'https://raw.githubusercontent.com/peter-wilkins/commandbook/main/',
    commands
  }

  return {
    ...withoutHash,
    indexHash: sha256(JSON.stringify(withoutHash))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = await buildCommandIndex()
  await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`)
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}
