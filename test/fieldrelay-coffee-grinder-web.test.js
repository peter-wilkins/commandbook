import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'

test('Field Relay browser coffee grinder runs livewind recipe', async () => {
  const sandbox = { console }
  sandbox.window = sandbox
  const source = await readFile(new URL('../web/fieldrelay/coffee-grinder.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, sandbox)

  const grinder = sandbox.CommandbookCoffeeGrinder
  const recipe = {
    queue: [
      {
        op: 'fetch_json',
        method: 'GET',
        url: 'https://weatherfile.com/V03/loc/{locId}/infowindow.ggl',
        defaults: {
          locId: 'GBR00005'
        },
        headers: { 'wf-tkn': 'PUBLIC' },
        outputFact: 'weatherfileInfowindow'
      },
      {
        op: 'extract_weatherfile_live_wind',
        sourceFact: 'weatherfileInfowindow',
        outputFact: 'liveWind'
      }
    ]
  }

  const adapters = grinder.createFieldRelayAdapters({
    now: () => new Date('2026-06-11T12:00:00Z'),
    invoke(payload) {
      assert.equal(payload.op, 'fetch')
      assert.equal(payload.url, 'https://weatherfile.com/V03/loc/GBR00005/infowindow.ggl')
      return {
        ok: true,
        status: 200,
        headers: {},
        body: JSON.stringify({
          data: {
            lastaverage: {
              wda: 221,
              wsa: 11.67,
              wsh: 16.15
            }
          }
        })
      }
    }
  })

  const ctx = grinder.createRunContext({
    command: 'livewind',
    recipe,
    args: {},
    now: new Date('2026-06-11T12:00:00Z')
  })
  const result = await grinder.runContext(ctx, adapters)

  assert.equal(result.status, 'complete')
  assert.equal(result.facts.liveWind.spoken, '23 31 SW')
  assert.equal(
    JSON.stringify(result.completed.map((item) => item.op)),
    JSON.stringify(['fetch_json', 'extract_weatherfile_live_wind'])
  )
})
