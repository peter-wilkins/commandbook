import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'

test('live_wind fetches WeatherFile data and reports avg max direction', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-live-wind-'))
  try {
    const fetchCalls = []
    const result = await runCommand({
      command: 'live_wind',
      args: { locId: 'GBR00005' },
      storeRoot: path.join(root, '.commandbook'),
      fetch: async (url, init) => {
        fetchCalls.push({ url, init })
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          async text() {
            return JSON.stringify({
              status: 'ok',
              data: {
                loc_id: 'GBR00005',
                display_name: 'Portland Harbour Fort Head',
                lastaverage: {
                  ts: '2026-06-11 10:10:00',
                  wda: 221,
                  wsa: 11.67,
                  wsh: 16.15
                }
              }
            })
          }
        }
      }
    })

    assert.equal(result.status, 'complete')
    assert.equal(fetchCalls[0].url, 'https://weatherfile.com/V03/loc/GBR00005/infowindow.ggl')
    assert.equal(fetchCalls[0].init.headers['wf-tkn'], 'PUBLIC')
    assert.equal(result.facts.liveWind.summary, '23 31 SW')
    assert.deepEqual(result.receipts.map((receipt) => receipt.op), [
      'fetch_json',
      'extract_weatherfile_live_wind'
    ])
    assert.equal(result.receipts.at(-1).result, '23 31 SW')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('live_wind uses the default Portland loc id when no loc-id is provided', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-live-wind-default-'))
  try {
    let fetchedUrl = ''
    await runCommand({
      command: 'live_wind',
      storeRoot: path.join(root, '.commandbook'),
      fetch: async (url) => {
        fetchedUrl = url
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          async text() {
            return JSON.stringify({
              status: 'ok',
              data: {
                loc_id: 'GBR00005',
                lastaverage: {
                  ts: '2026-06-11 10:10:00',
                  wda: 239,
                  wsa: 10.39,
                  wsh: 10.39
                }
              }
            })
          }
        }
      }
    })

    assert.equal(fetchedUrl, 'https://weatherfile.com/V03/loc/GBR00005/infowindow.ggl')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
