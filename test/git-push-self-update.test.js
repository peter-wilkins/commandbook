import assert from 'node:assert/strict'
import test from 'node:test'
import { createGitHandlers } from '../src/operations/git.js'

test('git push missing identity updates the current run queue only', async () => {
  const handlers = createGitHandlers()
  const item = { op: 'try_git_push_current_branch', phase: 'enter' }
  const ctx = {
    runId: 'run-test',
    runKey: 'runs/git_push_current_branch/run-test.json',
    command: 'git_push_current_branch',
    status: 'running',
    facts: {
      repoPath: '/tmp/example',
      commandArgs: {},
      autoApprove: true
    },
    goal: {},
    queue: [{ op: 'ask_are_you_happy', phase: 'enter' }],
    stack: [item],
    completed: [],
    inProgress: [{ item }],
    humanRequirements: [],
    approvals: {},
    receipts: [],
    failures: []
  }

  const result = await handlers.get('try_git_push_current_branch')(ctx, item, {
    clock: () => new Date('2026-06-07T20:00:00.000Z'),
    shell: async () => ({
      ok: false,
      code: 128,
      stdout: '',
      stderr: 'Author identity unknown\n\nPlease tell me who you are.'
    }),
    async loadRecipe(name) {
      assert.equal(name, 'configure_git_identity')
      return {
        queue: [
          { op: 'query_current_repo' },
          { op: 'query_git_identity' },
          { op: 'ensure_git_identity_facts' },
          { op: 'ask_are_you_happy' }
        ]
      }
    }
  })

  assert.equal(result.facts.gitIdentitySetupAttempted, true)
  assert.equal(result.failures[0].unplannedIssue, 'git_identity_missing')
  assert.deepEqual(result.queue.map((queued) => queued.op), [
    'query_current_repo',
    'query_git_identity',
    'ensure_git_identity_facts',
    'try_git_push_current_branch',
    'ask_are_you_happy'
  ])
})
