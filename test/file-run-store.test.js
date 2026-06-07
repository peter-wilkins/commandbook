import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { FileRunStore } from '../src/adapters/file-run-store.js'

test('FileRunStore writes, reads, lists, and deletes JSON state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-store-'))
  try {
    const store = new FileRunStore(root)
    const key = 'runs/example/run-1.json'
    const value = { status: 'running', queue: [{ op: 'next' }] }

    await store.put(key, value)

    assert.deepEqual(await store.get(key), value)
    assert.deepEqual(await store.list('runs'), [key])

    await store.del(key)
    assert.equal(await store.get(key), null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('FileRunStore rejects traversal keys', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-store-'))
  try {
    const store = new FileRunStore(root)
    assert.throws(() => store.pathFor('../secret.json'), /Unsafe run store key/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

