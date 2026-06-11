import { addReceipt } from '../core/context.js'

const DEFAULT_THRESHOLD_METRES = 0.9
const DEFAULT_DAY_START = '06:00'
const DEFAULT_ROUND_MINUTES = 20
const DEFAULT_MAX_START_BEFORE_HIGH_MINUTES = 165
const DEFAULT_MAX_END_AFTER_HIGH_MINUTES = 190

export function createTideTimesHandlers() {
  return new Map([
    ['extract_deepwater_windows', extractDeepwaterWindows]
  ])
}

async function extractDeepwaterWindows(ctx, item, adapters) {
  const html = ctx.facts[item.sourceFact ?? 'tideTimesHtml']
  if (typeof html !== 'string') throw new Error(`Missing TideTimes HTML fact: ${item.sourceFact}`)

  const args = { ...(item.defaults ?? {}), ...(ctx.facts.commandArgs ?? {}) }
  const thresholdMeters = Number(args.thresholdMeters ?? DEFAULT_THRESHOLD_METRES)
  const dayStart = String(args.dayStart ?? DEFAULT_DAY_START)
  const roundMinutes = Number(args.roundMinutes ?? DEFAULT_ROUND_MINUTES)
  const maxStartBeforeHighMinutes = Number(
    args.maxStartBeforeHighMinutes ?? DEFAULT_MAX_START_BEFORE_HIGH_MINUTES
  )
  const maxEndAfterHighMinutes = Number(args.maxEndAfterHighMinutes ?? DEFAULT_MAX_END_AFTER_HIGH_MINUTES)

  const prediction = parseTideTimesPage(html)
  const clipStart = chooseClipStart({ prediction, args, dayStart })
  const windows = calculateDeepwaterWindows({
    events: prediction.events,
    thresholdMeters,
    clipStartMinutes: clipStart,
    roundMinutes,
    maxStartBeforeHighMinutes,
    maxEndAfterHighMinutes
  })
  const summary = summariseWindows(windows)
  const nowMinutes = prediction.serverTimeMinutes
  const isDeepNow = prediction.pageDate === prediction.serverDate && windows.some((window) => (
    nowMinutes >= window.startMinutes && nowMinutes <= window.endMinutes
  ))
  const outputFact = item.outputFact ?? 'deepWater'
  const result = {
    summary,
    windows,
    isDeepNow,
    thresholdMeters,
    sourceDate: prediction.pageDate,
    locationName: prediction.locationName,
    tideEvents: prediction.events
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: result
    }
  }, {
    op: 'extract_deepwater_windows',
    result: summary,
    outputFact,
    sourceDate: prediction.pageDate,
    thresholdMeters
  }, adapters.clock)
}

export function parseTideTimesPage(html) {
  const locationName = textMatch(html, /<h1>(.*?)\s+Tide Times<\/h1>/i) ?? 'Unknown'
  const pageDate = dateFromCompact(textMatch(html, /\/dates-(\d{8})-\d+/i))
  const server = parseServerTime(html)
  const events = [...html.matchAll(
    /<tr class="vis2">[\s\S]*?<td class="tal">(High|Low)<\/td>[\s\S]*?<span>(\d{2}:\d{2})<\/span>[\s\S]*?<td class="tar">([0-9.]+)m<\/td>[\s\S]*?<\/tr>/gi
  )].map((match) => ({
    type: match[1],
    time: match[2],
    minutes: timeToMinutes(match[2]),
    heightMeters: Number(match[3])
  }))

  if (!pageDate) throw new Error('TideTimes page date was not found')
  if (events.length < 2) throw new Error('TideTimes page did not contain enough visible tide events')

  return {
    locationName: decodeHtml(locationName),
    pageDate,
    serverDate: server?.date,
    serverTimeMinutes: server?.minutes,
    events
  }
}

export function calculateDeepwaterWindows({
  events,
  thresholdMeters = DEFAULT_THRESHOLD_METRES,
  clipStartMinutes = 0,
  roundMinutes = DEFAULT_ROUND_MINUTES,
  maxStartBeforeHighMinutes = DEFAULT_MAX_START_BEFORE_HIGH_MINUTES,
  maxEndAfterHighMinutes = DEFAULT_MAX_END_AFTER_HIGH_MINUTES
}) {
  const windows = []
  let activeStart = null

  if (events[0].heightMeters >= thresholdMeters) activeStart = clipStartMinutes

  for (let index = 0; index < events.length - 1; index += 1) {
    const from = events[index]
    const to = events[index + 1]
    const fromDeep = from.heightMeters >= thresholdMeters
    const toDeep = to.heightMeters >= thresholdMeters

    if (!fromDeep && toDeep) {
      const crossing = crossingMinutes(from, to, thresholdMeters)
      const practicalStart = to.type === 'High'
        ? Math.max(crossing, to.minutes - maxStartBeforeHighMinutes)
        : crossing
      activeStart = Math.max(practicalStart, clipStartMinutes)
    } else if (fromDeep && !toDeep) {
      const crossing = crossingMinutes(from, to, thresholdMeters)
      const practicalEnd = from.type === 'High'
        ? Math.min(crossing, from.minutes + maxEndAfterHighMinutes)
        : crossing
      const start = activeStart ?? clipStartMinutes
      pushWindow(windows, start, practicalEnd, roundMinutes)
      activeStart = null
    } else if (fromDeep && toDeep && activeStart === null) {
      activeStart = Math.max(from.minutes, clipStartMinutes)
    }
  }

  const last = events.at(-1)
  if (activeStart !== null && last.heightMeters >= thresholdMeters) {
    pushWindow(windows, activeStart, 24 * 60, roundMinutes)
  }

  return mergeTouching(windows)
}

function chooseClipStart({ prediction, args, dayStart }) {
  if (args.fromTime) return timeToMinutes(String(args.fromTime))
  if (prediction.pageDate && prediction.pageDate === prediction.serverDate && prediction.serverTimeMinutes != null) {
    return prediction.serverTimeMinutes
  }
  return timeToMinutes(dayStart)
}

function pushWindow(windows, rawStart, rawEnd, roundMinutes) {
  const clippedStart = Math.max(0, Math.min(24 * 60, rawStart))
  const clippedEnd = Math.max(0, Math.min(24 * 60, rawEnd))
  if (clippedEnd <= clippedStart) return

  const startMinutes = roundUp(clippedStart, roundMinutes)
  const endMinutes = roundUp(clippedEnd, roundMinutes)
  if (endMinutes <= startMinutes) return

  windows.push({
    start: minutesToTime(startMinutes),
    end: minutesToTime(endMinutes),
    startMinutes,
    endMinutes
  })
}

function mergeTouching(windows) {
  return windows.reduce((merged, window) => {
    const previous = merged.at(-1)
    if (previous && previous.endMinutes >= window.startMinutes) {
      previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes)
      previous.end = minutesToTime(previous.endMinutes)
    } else {
      merged.push({ ...window })
    }
    return merged
  }, [])
}

function crossingMinutes(from, to, thresholdMeters) {
  const heightRange = to.heightMeters - from.heightMeters
  if (heightRange === 0) return to.minutes
  const fraction = (thresholdMeters - from.heightMeters) / heightRange
  return from.minutes + fraction * (to.minutes - from.minutes)
}

function parseServerTime(html) {
  const match = html.match(/timeServer\s*=\s*new Date\((\d{4}),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return null
  const [, year, zeroMonth, day, hour, minute] = match.map(Number)
  const month = zeroMonth + 1
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    minutes: hour * 60 + minute
  }
}

function dateFromCompact(value) {
  if (!value) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function summariseWindows(windows) {
  if (windows.length === 0) return 'not deep enough today'
  return windows.map((window) => `${dotTime(window.start)} till ${dotTime(window.end)}`).join(' and ')
}

function dotTime(value) {
  return value.replace(':', '.')
}

function textMatch(text, regex) {
  const match = text.match(regex)
  return match?.[1]?.trim()
}

function timeToMinutes(value) {
  const match = String(value).match(/^(\d{1,2}):?(\d{2})$/)
  if (!match) throw new Error(`Invalid time: ${value}`)
  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToTime(value) {
  const minutes = Math.max(0, Math.min(24 * 60, Math.round(value)))
  if (minutes === 24 * 60) return '24:00'
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function roundUp(value, step) {
  return Math.ceil(value / step) * step
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&pound;/g, '£')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
