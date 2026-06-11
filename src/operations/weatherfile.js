import { addReceipt } from '../core/context.js'

const METRES_PER_SECOND_TO_KNOTS = 1.9438444924406
const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW'
]

export function createWeatherfileHandlers() {
  return new Map([
    ['extract_weatherfile_live_wind', extractWeatherfileLiveWind]
  ])
}

async function extractWeatherfileLiveWind(ctx, item, adapters) {
  const sourceFact = item.sourceFact ?? 'weatherfileInfowindow'
  const payload = ctx.facts[sourceFact]
  if (!payload) throw new Error(`Missing WeatherFile payload fact: ${sourceFact}`)
  if (payload.status !== 'ok') throw new Error(`WeatherFile response was not ok: ${payload.status ?? 'unknown'}`)

  const data = payload.data
  const reading = data?.lastaverage
  if (!reading) throw new Error('WeatherFile response is missing data.lastaverage')

  const averageKnots = roundedKnots(reading.wsa)
  const maxKnots = roundedKnots(reading.wsh)
  const direction = compassDirection(reading.wda)
  const summary = `${averageKnots} ${maxKnots} ${direction}`
  const outputFact = item.outputFact ?? 'liveWind'
  const result = {
    summary,
    averageKnots,
    maxKnots,
    direction,
    directionDegrees: reading.wda,
    locId: data.loc_id ?? reading.loc_id,
    locationName: data.display_name,
    observedAt: reading.ts
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: result
    }
  }, {
    op: 'extract_weatherfile_live_wind',
    result: summary,
    outputFact,
    observedAt: reading.ts,
    locationName: data.display_name
  }, adapters.clock)
}

function roundedKnots(value) {
  if (!Number.isFinite(Number(value))) throw new Error(`Invalid wind speed: ${value}`)
  return Math.round(Number(value) * METRES_PER_SECOND_TO_KNOTS)
}

function compassDirection(degrees) {
  if (!Number.isFinite(Number(degrees))) throw new Error(`Invalid wind direction: ${degrees}`)
  const normalised = ((Number(degrees) % 360) + 360) % 360
  return COMPASS_16[Math.round(normalised / 22.5) % COMPASS_16.length]
}
