import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPlatformRuntimeAdapter } from '../src/core/platform-runtime-adapter.js'

test('minimal platform runtime adapter requires clock and run store', () => {
  const adapter = {
    descriptor: {
      runtimeId: 'linux_cli',
      platformId: 'linux',
      capabilities: {}
    },
    clock: () => new Date('2026-06-09T09:00:00Z'),
    runStore: {
      get: async () => null,
      put: async () => {},
      list: async () => [],
      del: async () => {}
    }
  }

  assert.equal(assertPlatformRuntimeAdapter(adapter), adapter)
})

test('declared optional capabilities must provide their method group', () => {
  const adapter = {
    descriptor: {
      runtimeId: 'field_relay_android',
      platformId: 'android',
      capabilities: {
        humanPrompt: true,
        surfaceOpen: true,
        foregroundTask: true,
        packageInspection: true,
        platformEvents: true
      }
    },
    clock: () => new Date('2026-06-09T09:00:00Z'),
    runStore: {
      get: async () => null,
      put: async () => {},
      list: async () => [],
      del: async () => {}
    },
    human: {
      prompt: async () => ({ status: 'submitted' })
    },
    surface: {
      open: async () => ({ status: 'opened' })
    },
    foregroundTask: {
      start: async () => ({ taskId: 'capture_1' }),
      stop: async () => ({ status: 'stopped' })
    },
    packages: {
      isInstalled: async () => true
    },
    events: {
      emit: async () => {}
    }
  }

  assert.equal(assertPlatformRuntimeAdapter(adapter), adapter)
})

test('adapter assertion fails when a declared capability is missing', () => {
  assert.throws(
    () => assertPlatformRuntimeAdapter({
      descriptor: {
        runtimeId: 'field_relay_android',
        platformId: 'android',
        capabilities: {
          foregroundTask: true
        }
      },
      clock: () => new Date('2026-06-09T09:00:00Z'),
      runStore: {
        get: async () => null,
        put: async () => {},
        list: async () => [],
        del: async () => {}
      }
    }),
    /missing foregroundTask/
  )
})
