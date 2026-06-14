import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'

test('runninglate prepares a dry-run message without sending', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-runninglate-'))
  try {
    const result = await runCommand({
      command: 'runninglate',
      args: {
        contact: 'Jane',
        destination: 'home',
        eta: '15 minutes',
        message: 'Traffic is slow.'
      },
      storeRoot: path.join(root, '.commandbook'),
      now: () => new Date('2026-06-14T12:00:00Z')
    })

    assert.equal(result.status, 'complete')
    assert.deepEqual(result.goal.effects, [])
    assert.equal(result.facts.runningLateDraft.mode, 'dry_run_only')
    assert.equal(result.facts.runningLateDraft.recipient, 'Jane')
    assert.equal(result.facts.runningLateDraft.channel, 'whatsapp_or_sms')
    assert.equal(
      result.facts.runningLateDraft.messageText,
      "I'm running late to home. ETA 15 minutes. Traffic is slow."
    )
    assert.equal(result.facts.runningLateDraft.sendEnabled, false)
    assert.equal(result.receipts.at(-1).result, 'draft_prepared')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('runninglate pauses when contact is missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-runninglate-missing-'))
  try {
    const result = await runCommand({
      command: 'runninglate',
      args: {
        eta: '15 minutes'
      },
      storeRoot: path.join(root, '.commandbook')
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements.at(-1).id, 'runninglate_contact_missing')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
