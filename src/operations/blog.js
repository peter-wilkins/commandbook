import crypto from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { addReceipt } from '../core/context.js'

export function createBlogHandlers() {
  return new Map([
    ['load_blog_site_profile', loadBlogSiteProfile],
    ['consume_blog_seed', consumeBlogSeed],
    ['prepare_blog_intent_grill', prepareBlogIntentGrill],
    ['draft_blog_post', draftBlogPost]
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

async function prepareBlogIntentGrill(ctx, _item, adapters) {
  const seed = ctx.facts.blogSeed
  const profile = ctx.facts.blogSiteProfile
  const questions = buildIntentQuestions(seed, profile)
  const intent = await readBlogIntentFromArgs(ctx.facts.commandArgs, adapters.cwd)

  if (intent) {
    return addReceipt({
      ...ctx,
      facts: {
        ...ctx.facts,
        blogIntentGrill: {
          site: ctx.facts.blogSite,
          seedTitle: seed.title,
          seedSource: seed.source,
          questions
        },
        blogIntent: normaliseBlogIntent(intent)
      }
    }, {
      op: 'prepare_blog_intent_grill',
      result: 'intent_loaded',
      intentFile: ctx.facts.commandArgs.intentFile
    }, adapters.clock)
  }

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

async function draftBlogPost(ctx, _item, adapters) {
  const intent = ctx.facts.blogIntent
  if (!intent) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'blog_intent_answers_missing',
          title: 'Blog intent answers needed',
          prompt: 'Provide --intent-file with the resolved Blog Intent Grill answers before drafting.',
          resumeHint: 'Create an intent JSON file and run again with --intent-file <path>.'
        }
      ]
    }
  }

  const outputPath = await resolveDraftOutputPath(ctx.facts.commandArgs, intent, adapters.cwd)
  if (!outputPath) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'blog_output_path_missing',
          title: 'Blog draft output needed',
          prompt: 'Provide --output <file.md> or --blog-repo <path> so Commandbook knows where to write the draft.',
          resumeHint: 'Run again with --blog-repo /path/to/astro-blog or --output /path/to/post.md.'
        }
      ]
    }
  }

  if (await fileExists(outputPath) && !ctx.facts.commandArgs.overwrite) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'blog_output_exists',
          title: 'Blog draft already exists',
          prompt: `${outputPath} already exists. Pass --overwrite or choose another --output.`,
          resumeHint: 'Run again with --overwrite after checking the existing draft.'
        }
      ]
    }
  }

  const markdown = composeBlogDraft({
    seed: ctx.facts.blogSeed,
    profile: ctx.facts.blogSiteProfile,
    intent,
    now: adapters.clock()
  })

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, markdown, 'utf8')

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      blogDraft: {
        title: intent.title,
        slug: intent.slug,
        path: outputPath,
        draft: true
      }
    }
  }, {
    op: 'draft_blog_post',
    result: 'draft_written',
    outputPath,
    slug: intent.slug
  }, adapters.clock)
}

function buildIntentQuestions(seed, profile) {
  return [
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
}

async function readBlogIntentFromArgs(args, cwd) {
  if (!args.intentFile) return null
  const intentPath = path.isAbsolute(args.intentFile) ? args.intentFile : path.join(cwd, args.intentFile)
  return JSON.parse(await readFile(intentPath, 'utf8'))
}

function normaliseBlogIntent(raw) {
  const title = raw.title ?? 'Before You Unleash the AI, De-Complect the Problem'
  return {
    title,
    slug: raw.slug ?? slugify(title),
    tldr: raw.tldr ?? raw.takeaway ?? 'AI makes it easy to add more features. Use a de-complect review before implementation to keep the product coherent.',
    description: raw.description ?? raw.tldr ?? raw.takeaway ?? 'A practical note on using Rich Hickey-inspired simplicity checks before AI-assisted implementation.',
    audience: raw.audience ?? '',
    takeaway: raw.takeaway ?? '',
    postKind: raw.postKind ?? raw.post_kind ?? '',
    evidence: arrayOf(raw.evidence),
    mood: raw.mood ?? '',
    sensitivity: arrayOf(raw.sensitivity),
    examples: arrayOf(raw.examples),
    counterpoints: arrayOf(raw.counterpoints),
    callToAction: raw.callToAction ?? '',
    tags: arrayOf(raw.tags)
  }
}

function arrayOf(value) {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

async function resolveDraftOutputPath(args, intent, cwd) {
  if (args.output) return resolveUserPath(args.output, cwd)
  if (args.blogRepo) return path.join(resolveUserPath(args.blogRepo, cwd), 'src', 'content', 'posts', `${intent.slug}.md`)
  if (await fileExists(path.join(cwd, 'src', 'content.config.ts'))) {
    return path.join(cwd, 'src', 'content', 'posts', `${intent.slug}.md`)
  }
  return null
}

function resolveUserPath(value, cwd) {
  return path.isAbsolute(value) ? value : path.join(cwd, value)
}

function composeBlogDraft({ seed, profile, intent, now }) {
  if (/hickey|decomplex|de-complect|complex/i.test(`${intent.title} ${seed.primaryText}`)) {
    return composeHickeyDecomplexDraft({ seed, profile, intent, now })
  }

  return [
    frontmatter({ seed, intent, now }),
    '',
    `> Draft generated from ${seed.title}. Edit before publishing.`,
    '',
    '## What This Is About',
    '',
    intent.takeaway || profile.defaultTakeaway,
    '',
    '## Draft Notes',
    '',
    '- Add the human story.',
    '- Add concrete examples.',
    '- Remove anything that sounds more mature than the product really is.',
    '',
    '## Call To Action',
    '',
    intent.callToAction || 'Try the idea on one small project first.'
  ].join('\n')
}

function composeHickeyDecomplexDraft({ seed, intent, now }) {
  const today = now.toISOString().slice(0, 10)
  const imageNotes = [
    '> Draft image notes:',
    '> - Add an original pirate-captain "more like guidelines" image, not a copyrighted film still.',
    '> - Add an original "unleash the AI" image: friendly chaos, too many plausible buttons, one tired human.'
  ].join('\n')

  return [
    frontmatter({ seed, intent, now }),
    '',
    imageNotes,
    '',
    'AI has made the easy path very easy.',
    '',
    'You can describe a feature, wait a few minutes, and get a screen, a schema, a button, a helper function, a test, a setting, a second mode, and a small dashboard you did not remember asking for. This is powerful. It is also how a product turns into soup before anyone notices.',
    '',
    'The hard part of software development was never only typing the code. It was deciding what should exist.',
    '',
    'That is where Rich Hickey is useful.',
    '',
    'Hickey is famous for drawing a sharp line between **simple** and **easy**. Easy is nearby. Easy is what the tool offers first. Easy is adding one more flag because the flag gets today\'s problem out of the way.',
    '',
    'Simple is different. Simple means not tangled. One thing. One job. One idea that can change without dragging a dozen unrelated ideas along with it.',
    '',
    'That distinction matters more now, not less, because AI agents are excellent at easy.',
    '',
    '## Feature Soup Is Cheap Now',
    '',
    'Imagine a note-taking app. At first it captures notes. Then someone says, "It would be useful if notes could have dates." Sensible enough. Then reminders. Then owners. Then projects. Then a dashboard. Then permissions. Then a CRM-style contact view. Then recurring reminders. Then a calendar sync.',
    '',
    'None of those requests is stupid in isolation.',
    '',
    'But after a while the original product is no longer a note-taking app. It is a task manager, calendar, CRM, dashboard, and half a project-management system, all wearing the same coat.',
    '',
    'A human team can do this slowly. An AI-assisted team can do it at frightening speed.',
    '',
    'Another familiar smell is the "simple settings object". It begins as user preferences. Then it grows feature flags. Then billing state. Then permissions. Then UI state. Then device capabilities. Then a little bit of cached server truth because it was convenient at the time.',
    '',
    'Eventually nobody knows what the settings object means. It has become a small god-object. It answers every question because every question was put inside it.',
    '',
    'The Hickeyian move is to stop and ask:',
    '',
    '```text',
    'What have we tied together that could vary independently?',
    '```',
    '',
    'That question is boring in the best possible way.',
    '',
    '## Simple Does Not Mean Tiny',
    '',
    'There is a trap here. "Simple" does not mean "small" in the sense of fewer files, fewer modules, or fewer deployable pieces.',
    '',
    'Sometimes splitting a thing makes the system simpler. Sometimes it just creates operational pain.',
    '',
    'Datomic is a useful counterexample for me. It is beautifully separated at the conceptual level: storage, transactor, peers, time, identity, value. But the fact that parts of it can be deployed and reasoned about separately does not automatically make operating it painless. In my experience, those separate deployable pieces could themselves become a source of friction.',
    '',
    'So this is not religion.',
    '',
    'It is more like guidelines.',
    '',
    'A split earns its keep when it makes the system easier to understand, test, recover, or change. If it only makes the diagram look clever, it is probably theatre.',
    '',
    '## The Unix Shape',
    '',
    'The Unix philosophy says: build small tools that do one thing well, then compose them.',
    '',
    'That idea is still alive because it keeps human reasoning cheap. `grep`, `sort`, `uniq`, and pipes are not impressive because each tool does everything. They are impressive because each tool does something clear, and the composition stays visible.',
    '',
    'Clojure has a similar feel in a different place. Instead of inventing a new method for every class of data, you learn a relatively small set of functions and apply them across maps, vectors, lists, sets, and lazy sequences. The Seq abstraction is one of the reasons this works: many things can be viewed as a sequence, and the same functions become reusable.',
    '',
    'Object-oriented systems often go the other way. A new kind of data brings a new set of methods. The operations get glued to the shapes. Sometimes that is useful. Sometimes it means the same idea is reimplemented in a dozen places because the system never made the common operation plain.',
    '',
    'This is the bit worth stealing: not Lisp, not Clojure, not any one technology, but the taste for reusable operations over simple data.',
    '',
    '## Why AI Makes This Urgent',
    '',
    'An AI agent will happily build whatever confused shape you describe.',
    '',
    'If you ask for "a simple dashboard with capture, reminders, publishing, team permissions, analytics, and AI suggestions", it may produce something that looks plausible. It may even work for the happy path. But the product truth is already muddy.',
    '',
    'The better use of an agent is earlier than that.',
    '',
    'Use it to grill the idea.',
    '',
    'Use it to read the docs and ask whether the app reality matches them.',
    '',
    'Use it to identify the nouns you have introduced.',
    '',
    'Use it to ask which nouns are secretly doing two jobs.',
    '',
    'Use it to find the one split that would reduce actual confusion, then demand proof that the split helped.',
    '',
    'The goal is not to make the architecture impressive. The goal is to keep the product coherent enough that a tired human can still understand it.',
    '',
    '## A Small De-Complect Review',
    '',
    'Before you set the AI loose, try this:',
    '',
    '```text',
    'De-complect review',
    '',
    '1. What are we about to build?',
    '2. What nouns have we introduced?',
    '3. Which nouns are doing more than one job?',
    '4. Which things vary independently?',
    '5. What is the smallest split that would make the next implementation clearer?',
    '6. What proof would show the split helped?',
    '```',
    '',
    'For a note-taking app, the review might reveal that notes, reminders, tasks, and contacts are separate concepts. They may still connect, but they should not be quietly fused just because the first implementation found it convenient.',
    '',
    'For a settings object, it might reveal that user preference, permission grant, billing status, feature flag, and UI state are different kinds of truth. They should not all sit in the same object merely because every screen needs to check them.',
    '',
    'For an AI-generated prototype, it might reveal that ten buttons are really a sign that nobody has found the primary action yet.',
    '',
    'That last one is often the big clue. A product with many plausible buttons but no obvious first move is usually not rich. It is unresolved.',
    '',
    '## Complexity Needs Proof',
    '',
    'There is one more rule I would add to the Hickeyian lens:',
    '',
    '```text',
    'Only complexify for improvement.',
    '```',
    '',
    'Adding a boundary, workflow, queue, schema, or service is not automatically wrong. But the extra moving part needs a feedback loop. It should reduce bugs, shorten tests, make recovery easier, make privacy safer, or cut the amount of context a human has to hold in their head.',
    '',
    'Without that proof, it is just more machinery.',
    '',
    'This matters because AI makes machinery cheap. Cheap machinery is still machinery.',
    '',
    'So before the next project sprint, after the grilling but before you unleash the AI, run a de-complect review.',
    '',
    'Ask what has been tied together.',
    '',
    'Ask what varies independently.',
    '',
    'Ask what proof would show the split helped.',
    '',
    'Then build the smallest thing that proves it.',
    '',
    'That is not slower. It is how you avoid going fast in the wrong shape.',
    '',
    '---',
    '',
    `Draft source note: generated on ${today} from the ChatGPT seed "${seed.title}" and the resolved Blog Intent Grill. The draft intentionally avoids private Commandbook internals and uses generic examples for public readability.`
  ].join('\n')
}

function frontmatter({ seed, intent, now }) {
  const tags = intent.tags.length > 0 ? intent.tags : ['ai-assisted-development', 'architecture', 'product-thinking', 'rich-hickey', 'complexity']
  return [
    '---',
    `title: ${yamlString(intent.title)}`,
    `tldr: ${yamlString(intent.tldr)}`,
    `description: ${yamlString(intent.description)}`,
    `date: ${yamlString(now.toISOString().slice(0, 10))}`,
    `sourceTitle: ${yamlString(seed.title)}`,
    `sourceCapturedAt: ${yamlString(now.toISOString())}`,
    `sourceHash: ${yamlString(seed.contentHash)}`,
    'draft: true',
    `tags: ${JSON.stringify(tags)}`,
    '---'
  ].join('\n')
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''))
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
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
