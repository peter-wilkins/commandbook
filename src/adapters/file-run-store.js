import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export class FileRunStore {
  constructor(rootDir) {
    this.rootDir = rootDir
  }

  async get(key) {
    const file = this.pathFor(key)
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async put(key, value) {
    const file = this.pathFor(key)
    await mkdir(path.dirname(file), { recursive: true })

    // Atomic-ish write: readers should see either old state or new state.
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
    await rename(tmp, file)
  }

  async list(prefix = '') {
    const dir = this.pathFor(prefix)
    return walk(dir, this.rootDir)
  }

  async del(key) {
    await rm(this.pathFor(key), { force: true })
  }

  pathFor(key) {
    if (key.includes('..') || path.isAbsolute(key)) {
      throw new Error(`Unsafe run store key: ${key}`)
    }
    return path.join(this.rootDir, key)
  }
}

async function walk(dir, rootDir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const found = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        found.push(...await walk(fullPath, rootDir))
      } else {
        found.push(path.relative(rootDir, fullPath))
      }
    }
    return found.sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

