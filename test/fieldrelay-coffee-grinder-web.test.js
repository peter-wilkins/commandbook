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

test('Field Relay browser coffee grinder runs deepwater recipe', async () => {
  const sandbox = { console }
  sandbox.window = sandbox
  const source = await readFile(new URL('../web/fieldrelay/coffee-grinder.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, sandbox)

  const grinder = sandbox.CommandbookCoffeeGrinder
  const recipe = {
    queue: [
      {
        op: 'fetch_text',
        method: 'GET',
        url: 'https://www.tidetimes.org.uk/{locationSlug}-tide-times{datePath}',
        defaults: {
          locationSlug: 'portland',
          datePath: ''
        },
        outputFact: 'tideTimesHtml'
      },
      {
        op: 'extract_deepwater_windows',
        sourceFact: 'tideTimesHtml',
        defaults: {
          thresholdMeters: '0.9',
          dayStart: '06:00',
          roundMinutes: '20',
          maxStartBeforeHighMinutes: '165',
          maxEndAfterHighMinutes: '190'
        },
        outputFact: 'deepWater'
      }
    ]
  }

  const adapters = grinder.createFieldRelayAdapters({
    now: () => new Date('2026-06-11T12:00:00Z'),
    invoke(payload) {
      assert.equal(payload.op, 'fetch')
      assert.equal(payload.url, 'https://www.tidetimes.org.uk/portland-tide-times')
      return {
        ok: true,
        status: 200,
        headers: {},
        body: `
          <h1>Portland Tide Times</h1>
          <iframe id="dates" src="/dates-20260611-43"></iframe>
          <table id="tides">
            <tr class="vis2"><td class="tal">High</td><td class="tac"><span>03:16</span></td><td class="tar">1.55m</td></tr>
            <tr class="vis2"><td class="tal">Low</td><td class="tac"><span>08:34</span></td><td class="tar">0.46m</td></tr>
            <tr class="vis2"><td class="tal">High</td><td class="tac"><span>16:10</span></td><td class="tar">1.58m</td></tr>
            <tr class="vis2"><td class="tal">Low</td><td class="tac"><span>20:57</span></td><td class="tar">0.63m</td></tr>
          </table>
          <script>var timeServer = new Date(2026, 5, 11, 13, 24, 13)</script>
        `
      }
    }
  })

  const ctx = grinder.createRunContext({
    command: 'deepwater',
    recipe,
    args: {},
    now: new Date('2026-06-11T12:00:00Z')
  })
  const result = await grinder.runContext(ctx, adapters)

  assert.equal(result.status, 'complete')
  assert.equal(result.facts.deepWater.summary, '13.40 till 19.20')
  assert.equal(
    JSON.stringify(result.completed.map((item) => item.op)),
    JSON.stringify(['fetch_text', 'extract_deepwater_windows'])
  )
})

test('Field Relay browser coffee grinder prepares runninglate send request', async () => {
  const sandbox = { console }
  sandbox.window = sandbox
  const source = await readFile(new URL('../web/fieldrelay/coffee-grinder.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, sandbox)

  const grinder = sandbox.CommandbookCoffeeGrinder
  const recipe = {
    queue: [
      {
        op: 'prepare_running_late_message',
        defaults: {
          contact: 'self',
          channel: 'whatsapp',
          eta: '10 minutes',
          autoSend: true,
          testChannel: true
        },
        outputFact: 'runningLateMessage'
      }
    ]
  }

  const ctx = grinder.createRunContext({
    command: 'runninglate',
    recipe,
    args: {},
    now: new Date('2026-06-14T12:00:00Z')
  })
  const result = await grinder.runContext(
    ctx,
    grinder.createFieldRelayAdapters({ invoke: () => ({ ok: true }) })
  )

  assert.equal(result.status, 'complete')
  assert.equal(result.facts.runningLateMessage.mode, 'trusted_test_send_request')
  assert.equal(result.facts.runningLateMessage.recipient, 'self')
  assert.equal(result.facts.runningLateMessage.sendEnabled, true)
  assert.equal(result.facts.runningLateMessage.requiresConfirmation, false)
  assert.equal(
    result.facts.runningLateMessage.messageText,
    'Running late, ETA 10 minutes.'
  )
})
