import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'
import { runShell, throwIfShellFailed } from '../src/adapters/shell.js'

test('configure_git_identity pauses when required identity facts are missing', async () => {
  const repo = await createTempRepo()
  try {
    const result = await runCommand({
      command: 'configure_git_identity',
      args: { repo },
      cwd: repo,
      storeRoot: path.join(repo, '.commandbook')
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'git_identity_missing')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('configure_git_identity writes and verifies repo-local git identity', async () => {
  const repo = await createTempRepo()
  try {
    const result = await runCommand({
      command: 'configure_git_identity',
      args: {
        repo,
        name: 'Commandbook Tester',
        email: 'tester@example.com',
        yes: true
      },
      cwd: repo,
      storeRoot: path.join(repo, '.commandbook')
    })

    assert.equal(result.status, 'complete')
    assert.deepEqual(result.facts.verifiedGitIdentity, {
      name: 'Commandbook Tester',
      email: 'tester@example.com'
    })

    const name = await gitConfig(repo, 'user.name')
    const email = await gitConfig(repo, 'user.email')
    assert.equal(name, 'Commandbook Tester')
    assert.equal(email, 'tester@example.com')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

async function createTempRepo() {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'commandbook-repo-'))
  throwIfShellFailed(await runShell('git', ['init'], { cwd: repo }), 'git init failed')
  return repo
}

async function gitConfig(repo, key) {
  const result = await runShell('git', ['config', '--local', '--get', key], { cwd: repo })
  throwIfShellFailed(result, `git config get ${key} failed`)
  return result.stdout.trim()
}

