import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'

test('install_taptap flow', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-taptap-'))
  const storeRoot = path.join(root, '.commandbook')

  await t.test('pauses when no device is connected', async () => {
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\n', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: {},
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'android_no_device')
  })

  await t.test('pauses and opens download link if TapTap is not installed', async () => {
    let urlOpened = false
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\nRF8N6017PKY\tdevice\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('com.kieronquinn.app.taptap')) {
        return { ok: true, code: 0, stdout: '', stderr: '' }
      }
      if (command === 'adb' && args.includes('am') && args.includes('https://github.com/KieronQuinn/TapTap/releases')) {
        urlOpened = true
        return { ok: true, code: 0, stdout: '', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: {},
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'taptap_apk_not_installed')
    assert.ok(urlOpened)
  })

  await t.test('pauses and opens accessibility settings if accessibility is disabled', async () => {
    let settingsOpened = false
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\nRF8N6017PKY\tdevice\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('com.kieronquinn.app.taptap')) {
        return { ok: true, code: 0, stdout: 'package:com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('settings') && args.includes('enabled_accessibility_services')) {
        return { ok: true, code: 0, stdout: 'some.other.service', stderr: '' }
      }
      if (command === 'adb' && args.includes('am') && args.includes('android.settings.ACCESSIBILITY_SETTINGS')) {
        settingsOpened = true
        return { ok: true, code: 0, stdout: '', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: {},
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'taptap_accessibility_disabled')
    assert.ok(settingsOpened)
  })

  await t.test('fails if Field Relay app is not installed', async () => {
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\nRF8N6017PKY\tdevice\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('com.kieronquinn.app.taptap')) {
        return { ok: true, code: 0, stdout: 'package:com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('settings') && args.includes('enabled_accessibility_services')) {
        return { ok: true, code: 0, stdout: 'com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('dev.peter.fieldrelay')) {
        return { ok: true, code: 0, stdout: '', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: {},
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'failed')
    assert.match(result.failures[0].message, /dev\.peter\.fieldrelay.*is not installed/)
  })

  await t.test('pauses for double-tap configuration if not auto-approved', async () => {
    let monkeyLaunched = false
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\nRF8N6017PKY\tdevice\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('com.kieronquinn.app.taptap')) {
        return { ok: true, code: 0, stdout: 'package:com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('settings') && args.includes('enabled_accessibility_services')) {
        return { ok: true, code: 0, stdout: 'com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('dev.peter.fieldrelay')) {
        return { ok: true, code: 0, stdout: 'package:dev.peter.fieldrelay', stderr: '' }
      }
      if (command === 'adb' && args.includes('dumpsys') && args.includes('shortcut')) {
        return { ok: true, code: 0, stdout: 'Package: dev.peter.fieldrelay\nfield_relay_capture\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('monkey') && args.includes('com.kieronquinn.app.taptap')) {
        monkeyLaunched = true
        return { ok: true, code: 0, stdout: '', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: {},
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'taptap_shortcut_not_configured')
    assert.ok(monkeyLaunched)
  })

  await t.test('completes when running with --yes', async () => {
    const mockShell = async (command, args) => {
      if (command === 'adb' && args.includes('devices')) {
        return { ok: true, code: 0, stdout: 'List of devices attached\nRF8N6017PKY\tdevice\n', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('com.kieronquinn.app.taptap')) {
        return { ok: true, code: 0, stdout: 'package:com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('settings') && args.includes('enabled_accessibility_services')) {
        return { ok: true, code: 0, stdout: 'com.kieronquinn.app.taptap', stderr: '' }
      }
      if (command === 'adb' && args.includes('pm') && args.includes('dev.peter.fieldrelay')) {
        return { ok: true, code: 0, stdout: 'package:dev.peter.fieldrelay', stderr: '' }
      }
      if (command === 'adb' && args.includes('dumpsys') && args.includes('shortcut')) {
        return { ok: true, code: 0, stdout: 'Package: dev.peter.fieldrelay\nfield_relay_capture\n', stderr: '' }
      }
      return { ok: true, code: 0, stdout: '', stderr: '' }
    }

    const result = await runCommand({
      command: 'install_taptap',
      args: { yes: true },
      cwd: root,
      storeRoot,
      shell: mockShell
    })

    assert.equal(result.status, 'complete')
    assert.equal(result.receipts.length, 1)
    assert.equal(result.receipts[0].op, 'install_taptap')
    assert.equal(result.receipts[0].result, 'completed')
  })

  await rm(root, { recursive: true, force: true })
})
