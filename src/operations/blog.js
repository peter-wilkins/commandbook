import crypto from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { addReceipt } from '../core/context.js'

export function createBlogHandlers() {
  return new Map([
    ['load_blog_site_profile', loadBlogSiteProfile],
    ['consume_blog_seed', consumeBlogSeed],
    ['prepare_blog_intent_grill', prepareBlogIntentGrill]
  ])
}

async function loadBlogSiteProfile(ctx, item, adapters) {
  const args = ctx.facts.commandArgs
  const site = args.site ?? item.defaultSite ?? 'continuumkit'
  const profilePath = path.join(adapters.projectRoot, 'sites', site, 'editorial-profile.json')

  let profile
  try {
    profile = JSON.parse(await readFile(profilePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        ...ctx,
        status: 'paused_for_human',
        humanRequirements: [
          ...ctx.humanRequirements,
          {
            id: 'blog_site_profile_missing',
            title: 'Blog site profile needed',
            prompt: `No editorial profile exists for site "${site}". Add ${profilePath} or choose another --site.`,
            resumeHint: 'Run again with --site <known-site>.'
          }
        ]
      }
    }
    throw error
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      blogSite: site,
      blogSiteProfile: profile,
      blogSiteProfilePath: profilePath
    }
  }, {
    op: 'load_blog_site_profile',
    site,
    profilePath
  }, adapters.clock)
}

async function consumeBlogSeed(ctx, _item, adapters) {
  const args = ctx.facts.commandArgs
  const seed = args.seed

  if (!seed) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'blog_seed_missing',
          title: 'Blog seed needed',
          prompt: 'Provide --seed as a file path, URL, or short text idea.',
          resumeHint: 'Run again with --seed <path-or-url-or-text>.'
        }
      ]
    }
  }

  const seedRead = await readSeed(seed, adapters.cwd)
  const material = extractBlogSeedMaterial(seedRead)

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      blogSeed: material
    }
  }, {
    op: 'consume_blog_seed',
    source: seedRead.source,
    sourceKind: seedRead.sourceKind,
    title: material.title,
    extractionQuality: material.extractionQuality,
    primaryTextChars: material.primaryText.length,
    contentHash: material.contentHash
  }, adapters.clock)
}

async function prepareBlogIntentGrill(ctx) {
  const seed = ctx.facts.blogSeed
  const profile = ctx.facts.blogSiteProfile
  const questions = [
    {
      id: 'audience',
      question: 'Who is this for?',
      recommendedAnswer: profile.audience
    },
    {
      id: 'takeaway',
      question: 'What should readers understand or feel by the end?',
      recommendedAnswer: inferTakeaway(seed, profile)
    },
    {
      id: 'post_kind',
      question: 'What kind of post is this?',
      recommendedAnswer: 'philosophical experience report'
    },
    {
      id: 'evidence',
      question: 'What source or evidence must be used?',
      recommendedAnswer: 'Use the ChatGPT seed article, then add Continuum Kit examples only where they clarify the idea.'
    },
    {
      id: 'mood',
      question: 'What mood and style should it have?',
      recommendedAnswer: profile.defaultTone
    },
    {
      id: 'sensitivity',
      question: 'Is anything sensitive or not for publication?',
      recommendedAnswer: 'Do not publish raw private logs or imply Commandbook security is implemented beyond YOLO local mode.'
    }
  ]

  return {
    ...ctx,
    status: 'paused_for_human',
    facts: {
      ...ctx.facts,
      blogIntentGrill: {
        site: ctx.facts.blogSite,
        seedTitle: seed.title,
        seedSource: seed.source,
        questions
      }
    },
    humanRequirements: [
      ...ctx.humanRequirements,
      {
        id: 'blog_intent_grill',
        title: 'Blog Intent Grill',
        prompt: formatBlogIntentPrompt({ seed, profile, questions }),
        questions,
        resumeHint: 'Answer the six questions, then resume the run with those answers.'
      }
    ]
  }
}

async function readSeed(seed, cwd) {
  if (/^https?:\/\//.test(seed)) {
    const response = await fetch(seed, {
      headers: {
        'user-agent': 'CommandbookBlogSeed/0.1 (+local)'
      }
    })
    if (!response.ok) throw new Error(`Seed fetch failed: ${response.status} ${response.statusText}`)
    return {
      source: seed,
      sourceKind: 'url',
      raw: await response.text()
    }
  }

  const seedPath = path.isAbsolute(seed) ? seed : path.join(cwd, seed)
  if (await fileExists(seedPath)) {
    return {
      source: seedPath,
      sourceKind: 'file',
      raw: await readFile(seedPath, 'utf8')
    }
  }

  return {
    source: 'inline',
    sourceKind: 'inline_text',
    raw: seed
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function extractBlogSeedMaterial(seedRead) {
  const title = extractHtmlTitle(seedRead.raw) ?? 'Untitled seed'
  const readableStrings = extractReadableStrings(seedRead.raw)
  const primaryText = choosePrimaryText(readableStrings, seedRead.raw)
  const promptText = readableStrings.find((text) => /^Blog post for me/i.test(text)) ?? ''
  const supportingSnippets = readableStrings
    .filter((text) => text !== primaryText && text !== promptText)
    .slice(0, 8)

  return {
    source: seedRead.source,
    sourceKind: seedRead.sourceKind,
    title,
    promptText,
    primaryText,
    supportingSnippets,
    extractionQuality: primaryText.length >= 500 ? 'usable' : 'thin',
    warnings: primaryText.length >= 500 ? [] : ['Seed extraction found little readable body text.'],
    contentHash: sha256(primaryText || seedRead.raw)
  }
}

function extractHtmlTitle(raw) {
  const match = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return null
  return decodeHtml(match[1]).replace(/\s+/g, ' ').trim()
}

function extractReadableStrings(raw) {
  const streamText = decodeReactRouterStream(raw)
  const source = streamText || raw
  const strings = []

  for (const match of source.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    try {
      const value = JSON.parse(match[0]).replace(/\s+/g, ' ').trim()
      if (isReadableSeedString(value)) strings.push(value)
    } catch {
      // Ignore broken quoted fragments; ChatGPT share streams are not plain JSON.
    }
  }

  return unique(strings)
}

function decodeReactRouterStream(raw) {
  const chunks = []
  for (const match of raw.matchAll(/streamController\.enqueue\("([\s\S]*?)"\);/g)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`))
    } catch {
      // Keep the extractor best-effort. A malformed chunk should not fail the run.
    }
  }
  return chunks.join('\n')
}

function isReadableSeedString(value) {
  return (
    value.length >= 90 &&
    /[a-zA-Z]/.test(value) &&
    value.split(' ').length >= 12 &&
    !/^https?:/.test(value) &&
    !value.includes('/cdn/assets/') &&
    !value.includes('function(')
  )
}

function choosePrimaryText(readableStrings, raw) {
  if (readableStrings.length > 0) {
    return [...readableStrings].sort((left, right) => right.length - left.length)[0]
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
}

function inferTakeaway(seed, profile) {
  if (/hickey/i.test(seed.title) || /hickey/i.test(seed.primaryText)) {
    return 'Readers should understand why untangling concepts is more valuable than adding clever machinery.'
  }
  return profile.defaultTakeaway
}

function formatBlogIntentPrompt({ seed, profile, questions }) {
  const lines = [
    `Seed: ${seed.title}`,
    `Source: ${seed.source}`,
    `Site: ${profile.site}`,
    '',
    'Seed excerpt:',
    truncate(seed.primaryText, 700),
    '',
    'Answer these before drafting:'
  ]

  for (const [index, question] of questions.entries()) {
    lines.push(`${index + 1}. ${question.question}`)
    lines.push(`   Recommended: ${question.recommendedAnswer}`)
  }

  return lines.join('\n')
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function truncate(value, limit) {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`
}

function unique(values) {
  return [...new Set(values)]
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`
}
