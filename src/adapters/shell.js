import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class ShellError extends Error {
  constructor(message, result) {
    super(message)
    this.name = 'ShellError'
    Object.assign(this, result)
  }
}

export async function runShell(command, args = [], options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout ?? 30_000,
      maxBuffer: options.maxBuffer ?? 1024 * 1024
    })
    return { ok: true, code: 0, stdout, stderr }
  } catch (error) {
    return {
      ok: false,
      code: error.code,
      signal: error.signal,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      message: error.message
    }
  }
}

export function throwIfShellFailed(result, message) {
  if (!result.ok) {
    throw new ShellError(message, result)
  }
  return result
}

