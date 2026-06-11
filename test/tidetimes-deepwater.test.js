import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'
import { calculateDeepwaterWindows, parseTideTimesPage } from '../src/operations/tidetimes.js'

test('deepwater returns this afternoon Portland guideline from TideTimes rows', async () => {
  const result = extractDeepwater(portlandTodayHtml())

  assert.equal(result.sourceDate, '2026-06-11')
  assert.equal(result.summary, '13.40 till 19.20')
})

test('deepwater returns 16 June Portland guideline windows', async () => {
  const prediction = parseTideTimesPage(portlandJune16Html())
  const windows = calculateDeepwaterWindows({
    events: prediction.events,
    thresholdMeters: 0.9,
    clipStartMinutes: 6 * 60,
    roundMinutes: 20,
    maxStartBeforeHighMinutes: 165,
    maxEndAfterHighMinutes: 190
  })

  assert.deepEqual(windows.map(({ start, end }) => `${start} till ${end}`), [
    '06:00 till 11:40',
    '18:00 till 24:00'
  ])
})

test('deepwater command fetches TideTimes HTML and stores the answer fact', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commandbook-deepwater-'))
  try {
    const result = await runCommand({
      command: 'deepwater',
      storeRoot: path.join(root, '.commandbook'),
      fetch: async (url, init) => {
        assert.equal(url, 'https://www.tidetimes.org.uk/portland-tide-times')
        assert.equal(init.headers.Accept, 'text/html,*/*')
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          async text() {
            return portlandTodayHtml()
          }
        }
      }
    })

    assert.equal(result.status, 'complete')
    assert.equal(result.facts.deepWater.summary, '13.40 till 19.20')
    assert.deepEqual(result.receipts.map((receipt) => receipt.op), [
      'fetch_text',
      'extract_deepwater_windows'
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

function extractDeepwater(html) {
  const prediction = parseTideTimesPage(html)
  const windows = calculateDeepwaterWindows({
    events: prediction.events,
    thresholdMeters: 0.9,
    clipStartMinutes: prediction.serverTimeMinutes,
    roundMinutes: 20,
    maxStartBeforeHighMinutes: 165,
    maxEndAfterHighMinutes: 190
  })
  return {
    sourceDate: prediction.pageDate,
    summary: windows.map(({ start, end }) => `${start.replace(':', '.')} till ${end.replace(':', '.')}`).join(' and ')
  }
}

function portlandTodayHtml() {
  return page({
    date: '20260611',
    server: 'var timeServer = new Date(2026, 5, 11, 13, 24, 13)',
    rows: [
      ['High', '03:16', '1.55m'],
      ['Low', '08:34', '0.46m'],
      ['High', '16:10', '1.58m'],
      ['Low', '20:57', '0.63m']
    ]
  })
}

function portlandJune16Html() {
  return page({
    date: '20260616',
    server: 'var timeServer = new Date(2026, 5, 11, 13, 24, 13)',
    rows: [
      ['Low', '00:55', '0.34m'],
      ['High', '08:27', '2.01m'],
      ['Low', '13:14', '0.27m'],
      ['High', '20:42', '2.25m']
    ]
  })
}

function page({ date, server, rows }) {
  return `
    <html>
      <body>
        <h1>Portland Tide Times</h1>
        <iframe id="dates" src="/dates-${date}-43"></iframe>
        <table id="tides">
          ${rows.map(([type, time, height]) => `
            <tr class="vis2">
              <td class="tal">${type}</td>
              <td class="tac"><span>${time}</span></td>
              <td class="tar">${height}</td>
            </tr>
          `).join('')}
        </table>
        <script>${server}</script>
      </body>
    </html>
  `
}
