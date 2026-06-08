import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export class FileEventStore {
  constructor(rootDir) {
    this.rootDir = rootDir
  }

  async append(event) {
    const file = this.pathForEvent(event)
    await mkdir(path.dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify(event)}\n`)
  }

  async list() {
    const dir = path.join(this.rootDir, 'events')
    const files = await walk(dir)
    const events = []
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      for (const line of text.split('\n')) {
        if (line.trim()) events.push(JSON.parse(line))
      }
    }
    return events.sort((left, right) => left.at.localeCompare(right.at))
  }

  pathForEvent(event) {
    const day = event.at.slice(0, 10)
    return path.join(this.rootDir, 'events', `${day}.jsonl`)
  }
}

export function createRuntimeEvent({ type, facts = {}, source = 'cli', at = new Date(), scope = {}, dedupeKey }) {
  const stamp = at.toISOString()
  const suffix = Math.random().toString(36).slice(2, 10).padEnd(8, '0')
  return {
    eventId: `evt_${stamp.replace(/[:.]/g, '-')}_${suffix}`,
    type,
    at: stamp,
    source,
    scope,
    facts,
    dedupeKey: dedupeKey ?? `${type}/${stamp}`
  }
}

async function walk(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const found = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        found.push(...await walk(fullPath))
      } else {
        found.push(fullPath)
      }
    }
    return found.sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}
