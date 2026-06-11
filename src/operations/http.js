import { addReceipt } from '../core/context.js'

export function createHttpHandlers() {
  return new Map([
    ['fetch_text', fetchText],
    ['fetch_json', fetchJson]
  ])
}

async function fetchText(ctx, item, adapters) {
  const url = renderTemplate(item.url, ctx, item.defaults)
  if (!url) throw new Error('fetch_text needs item.url')

  const method = item.method ?? 'GET'
  const headers = renderHeaders(item.headers ?? {}, ctx, item.defaults)
  const response = await (adapters.fetch ?? fetch)(url, {
    method,
    headers: {
      accept: 'text/html,*/*',
      ...headers
    }
  })

  if (!response.ok) {
    throw new Error(`fetch_text failed: HTTP ${response.status} ${response.statusText ?? ''}`.trim())
  }

  const body = await response.text()
  const outputFact = item.outputFact ?? 'lastFetchText'

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: body
    }
  }, {
    op: 'fetch_text',
    result: 'fetched',
    url,
    status: response.status,
    outputFact
  }, adapters.clock)
}

async function fetchJson(ctx, item, adapters) {
  const url = renderTemplate(item.url, ctx, item.defaults)
  if (!url) throw new Error('fetch_json needs item.url')

  const method = item.method ?? 'GET'
  const headers = renderHeaders(item.headers ?? {}, ctx, item.defaults)
  const response = await (adapters.fetch ?? fetch)(url, {
    method,
    headers: {
      accept: 'application/json',
      ...headers
    }
  })

  if (!response.ok) {
    throw new Error(`fetch_json failed: HTTP ${response.status} ${response.statusText ?? ''}`.trim())
  }

  const body = await response.text()
  const json = JSON.parse(body)
  const outputFact = item.outputFact ?? 'lastFetchJson'

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: json
    }
  }, {
    op: 'fetch_json',
    result: 'fetched',
    url,
    status: response.status,
    outputFact
  }, adapters.clock)
}

function renderHeaders(headers, ctx, defaults = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      renderTemplate(String(value), ctx, defaults)
    ])
  )
}

function renderTemplate(value, ctx, defaults = {}) {
  if (typeof value !== 'string') return value
  return value.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_match, key) => {
    const resolved = lookup(key, ctx.facts.commandArgs) ?? lookup(key, ctx.facts) ?? lookup(key, defaults)
    if (resolved === undefined || resolved === null) {
      throw new Error(`Missing template value: ${key}`)
    }
    return encodeURIComponent(String(resolved))
  })
}

function lookup(key, source = {}) {
  if (Object.hasOwn(source, key)) return source[key]
  const camelKey = key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
  if (Object.hasOwn(source, camelKey)) return source[camelKey]
  const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  if (Object.hasOwn(source, snakeKey)) return source[snakeKey]
  return key.split('.').reduce((value, part) => value?.[part], source)
}
