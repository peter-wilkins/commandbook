import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { FileRunStore } from '../src/adapters/file-run-store.js'

const execFileAsync = promisify(execFile)
const cli = path.resolve('src/cli/commandbook.js')

test('wifi.available wakes a paused simulated water-trip upload branch', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-events-'))
  const storeDir = path.join(root, '.commandbook')
  try {
    const started = await execFileAsync('node', [
      cli,
      'simulate_water_trip_logger',
      '--store-dir',
      storeDir,
      '--network',
      'offline',
      '--yes'
    ])

    assert.match(started.stdout, /status: paused_for_event/)
    assert.match(started.stdout, /wifi\.available/)

    const emitted = await execFileAsync('node', [
      cli,
      'emit',
      'wifi.available',
      '--store-dir',
      storeDir,
      '--fact',
      'network_kind=wifi',
      '--fact',
      'internet_reachable=true'
    ])

    assert.match(emitted.stdout, /event: wifi\.available/)
    assert.match(emitted.stdout, /resumed: 1/)

    const status = await execFileAsync('node', [cli, 'status', '--store-dir', storeDir])
    assert.match(status.stdout, /status: complete/)
    assert.match(status.stdout, /ping_server_location: uploaded/)

    const events = await execFileAsync('node', [cli, 'list', 'events', '--store-dir', storeDir])
    assert.match(events.stdout, /wifi\.available/)

    const duplicate = await execFileAsync('node', [
      cli,
      'emit',
      'wifi.available',
      '--store-dir',
      storeDir,
      '--fact',
      'network_kind=wifi'
    ])
    assert.match(duplicate.stdout, /resumed: 0/)

    const store = new FileRunStore(storeDir)
    const [runKey] = await store.list('runs')
    const run = await store.get(runKey)
    assert.equal(run.eventSummary.receivedCount, 1)
    assert.equal(run.recentEvents.length, 1)
    assert.equal(run.recentEvents[0].type, 'wifi.available')
    assert.deepEqual(run.waitingForEvents, [])

    const localPath = run.facts.simulatedLocalRichPath
    assert.match(await readFile(localPath, 'utf8'), /"kind":"rich_location"/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
