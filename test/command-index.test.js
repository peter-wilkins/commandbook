import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildCommandIndex } from '../scripts/build-command-index.js'

test('checked-in command index matches recipe metadata', async () => {
  const expected = JSON.parse(await readFile('command-index.json', 'utf8'))
  const actual = await buildCommandIndex()

  assert.deepEqual(actual, expected)
})
