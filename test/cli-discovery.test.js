import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { FileRunStore } from '../src/adapters/file-run-store.js'

const execFileAsync = promisify(execFile)
const cli = path.resolve('src/cli/commandbook.js')

test('CLI lists commands with descriptions', async () => {
  const { stdout } = await execFileAsync('node', [cli, 'list', 'commands'])

  assert.match(stdout, /configure_git_identity - Configure git user\.name/)
  assert.match(stdout, /git_push_current_branch - Push the current branch/)
})

test('CLI prints command help from recipe metadata', async () => {
  const { stdout } = await execFileAsync('node', [cli, 'help', 'git_push_current_branch', '--long'])

  assert.match(stdout, /commandbook git_push_current_branch --yes/)
  assert.match(stdout, /docs\/runtime\/reusable-core\.md/)
  assert.match(stdout, /try_git_push_current_branch/)
})

test('CLI prints latest run status from the run store', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-cli-store-'))
  try {
    const store = new FileRunStore(root)
    await store.put('runs/example/2026-06-08T09-00-00-000Z_test.json', {
      runId: '2026-06-08T09-00-00-000Z_test',
      runKey: 'runs/example/2026-06-08T09-00-00-000Z_test.json',
      command: 'example',
      status: 'running',
      facts: {},
      goal: {},
      queue: [{ op: 'next' }],
      stack: [],
      completed: [],
      inProgress: [],
      humanRequirements: [],
      approvals: {},
      receipts: [],
      failures: []
    })

    const { stdout } = await execFileAsync('node', [cli, 'status', '--store-dir', root])

    assert.match(stdout, /status: running/)
    assert.match(stdout, /run: runs\/example\/2026-06-08T09-00-00-000Z_test\.json/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
