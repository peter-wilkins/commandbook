import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { addReceipt } from '../core/context.js'

export function createSimulationHandlers() {
  return new Map([
    ['start_simulated_trip_session', startSimulatedTripSession],
    ['save_local_rich_location', saveLocalRichLocation],
    ['ping_server_location', pingServerLocation]
  ])
}

async function startSimulatedTripSession(ctx, _item, adapters) {
  const args = ctx.facts.commandArgs
  const sessionId = args.sessionId ?? `water_trip_${ctx.runId}`
  const sessionDir = path.join(adapters.store.rootDir, 'simulated-water-trips', sessionId)
  await mkdir(sessionDir, { recursive: true })

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      sessionId,
      simulatedSessionDir: sessionDir,
      networkAvailable: args.network !== 'offline'
    }
  }
}

async function saveLocalRichLocation(ctx, _item, adapters) {
  const file = path.join(ctx.facts.simulatedSessionDir, 'rich-location.jsonl')
  const record = {
    kind: 'rich_location',
    seq: 1,
    at: adapters.clock().toISOString(),
    lat: 50.6,
    lon: -2.4,
    accuracy: 8,
    source: 'fake_location_driver'
  }

  await appendFile(file, `${JSON.stringify(record)}\n`)

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      simulatedLocalRichPath: file,
      lastLocalLocationSeq: record.seq
    }
  }, {
    op: 'save_local_rich_location',
    result: 'saved',
    path: file
  }, adapters.clock)
}

async function pingServerLocation(ctx, item, adapters) {
  if (!ctx.facts.networkAvailable) {
    return {
      ...ctx,
      status: 'paused_for_event',
      waitingForEvents: [
        {
          type: 'wifi.available',
          reason: 'Upload live location when Wi-Fi returns.'
        },
        {
          type: 'network.available',
          reason: 'Upload live location when network returns.'
        }
      ],
      queue: [item, ...ctx.queue]
    }
  }

  const file = path.join(ctx.facts.simulatedSessionDir, 'live-pings.jsonl')
  const record = {
    kind: 'live_ping',
    requestId: `${ctx.facts.sessionId}/1`,
    at: adapters.clock().toISOString(),
    status: 'uploaded'
  }

  await appendFile(file, `${JSON.stringify(record)}\n`)

  return addReceipt({
    ...ctx,
    waitingForEvents: [],
    facts: {
      ...ctx.facts,
      simulatedLivePingPath: file,
      lastLiveUploadSeq: 1
    }
  }, {
    op: 'ping_server_location',
    result: 'uploaded',
    path: file
  }, adapters.clock)
}
