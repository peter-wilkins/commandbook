export function createRunId({ now = new Date(), random = Math.random } = {}) {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const suffix = random().toString(36).slice(2, 10).padEnd(8, '0')
  return `${stamp}_${suffix}`
}

