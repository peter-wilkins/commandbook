import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'

test('runninglate requests WhatsApp send on trusted test channel by default', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-runninglate-'))
  try {
    const result = await runCommand({
      command: 'runninglate',
      args: {},
      storeRoot: path.join(root, '.commandbook'),
      now: () => new Date('2026-06-14T12:00:00Z')
    })

    assert.equal(result.status, 'complete')
    assert.deepEqual(result.goal.effects, ['whatsapp_message_send_requested'])
    assert.equal(result.facts.runningLateMessage.mode, 'trusted_test_send_request')
    assert.equal(result.facts.runningLateMessage.recipient, 'self')
    assert.equal(result.facts.runningLateMessage.channel, 'whatsapp')
    assert.equal(
      result.facts.runningLateMessage.messageText,
      'Running late, ETA 10 minutes.'
    )
    assert.equal(result.facts.runningLateMessage.sendEnabled, true)
    assert.equal(result.facts.runningLateMessage.requiresConfirmation, false)
    assert.equal(result.facts.runningLateMessage.smsFallback, false)
    assert.equal(result.receipts.at(-1).result, 'send_requested')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('runninglate pauses when contact is explicitly blanked', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-runninglate-missing-'))
  try {
    const result = await runCommand({
      command: 'runninglate',
      args: {
        contact: '',
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
