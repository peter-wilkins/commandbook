import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runCommand } from '../src/index.js'

test('blog writing command consumes a ChatGPT share seed and pauses for intent grill', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commandbook-blog-'))
  try {
    const seedPath = path.join(dir, 'hickey-share.html')
    await writeFile(seedPath, chatGptShareFixture(), 'utf8')

    const result = await runCommand({
      command: 'write_and_publish_blog_post',
      args: {
        site: 'continuumkit',
        seed: seedPath,
        dryRun: true
      },
      cwd: dir,
      storeRoot: path.join(dir, '.commandbook')
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.facts.blogSite, 'continuumkit')
    assert.equal(result.facts.blogSeed.title, 'ChatGPT - The Hickeyian Way')
    assert.equal(result.facts.blogSeed.extractionQuality, 'usable')
    assert.match(result.facts.blogSeed.primaryText, /Reality is already complicated enough/)
    assert.match(result.facts.blogSeed.promptText, /Blog post for me/)

    const requirement = result.humanRequirements.find((item) => item.id === 'blog_intent_grill')
    assert.ok(requirement)
    assert.equal(requirement.questions.length, 6)
    assert.match(requirement.prompt, /Who is this for/)
    assert.match(requirement.prompt, /do not publish raw private logs or imply Commandbook security is implemented/i)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blog writing command writes a draft when intent answers are supplied', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commandbook-blog-'))
  try {
    const seedPath = path.join(dir, 'hickey-share.html')
    const blogRepo = path.join(dir, 'blog')
    const intentPath = path.join(dir, 'intent.json')
    await writeFile(seedPath, chatGptShareFixture(), 'utf8')
    await writeFile(intentPath, JSON.stringify({
      title: 'Before You Unleash the AI, De-Complect the Problem',
      slug: 'before-you-unleash-the-ai-decomplex-the-problem',
      tldr: 'AI makes feature soup cheap. Run a de-complect review before implementation.',
      description: 'A practical note on keeping AI-assisted products coherent.',
      takeaway: 'Keep product concepts untangled before asking agents to build.',
      tags: ['ai-assisted-development', 'architecture']
    }), 'utf8')

    const result = await runCommand({
      command: 'write_and_publish_blog_post',
      args: {
        site: 'continuumkit',
        seed: seedPath,
        intentFile: intentPath,
        blogRepo
      },
      cwd: dir,
      storeRoot: path.join(dir, '.commandbook')
    })

    assert.equal(result.status, 'complete')
    const draftPath = path.join(blogRepo, 'src/content/posts/before-you-unleash-the-ai-decomplex-the-problem.md')
    const draft = await readFile(draftPath, 'utf8')
    assert.match(draft, /draft: true/)
    assert.match(draft, /Before You Unleash the AI, De-Complect the Problem/)
    assert.match(draft, /What have we tied together that could vary independently/)
    assert.match(draft, /Only complexify for improvement/)
    assert.equal(result.facts.blogDraft.path, draftPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blog writing command refuses to overwrite an existing draft without explicit overwrite', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commandbook-blog-'))
  try {
    const seedPath = path.join(dir, 'hickey-share.html')
    const outputPath = path.join(dir, 'existing.md')
    const intentPath = path.join(dir, 'intent.json')
    await writeFile(seedPath, chatGptShareFixture(), 'utf8')
    await writeFile(outputPath, 'existing', 'utf8')
    await writeFile(intentPath, JSON.stringify({
      title: 'Before You Unleash the AI, De-Complect the Problem',
      slug: 'before-you-unleash-the-ai-decomplex-the-problem'
    }), 'utf8')

    const result = await runCommand({
      command: 'write_and_publish_blog_post',
      args: {
        site: 'continuumkit',
        seed: seedPath,
        intentFile: intentPath,
        output: outputPath
      },
      cwd: dir,
      storeRoot: path.join(dir, '.commandbook')
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements.at(-1).id, 'blog_output_exists')
    assert.equal(await readFile(outputPath, 'utf8'), 'existing')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blog writing command pauses when seed is missing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commandbook-blog-'))
  try {
    const result = await runCommand({
      command: 'write_and_publish_blog_post',
      args: {
        site: 'continuumkit'
      },
      cwd: dir,
      storeRoot: path.join(dir, '.commandbook')
    })

    assert.equal(result.status, 'paused_for_human')
    assert.equal(result.humanRequirements[0].id, 'blog_seed_missing')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

function chatGptShareFixture() {
  const stream = [
    '[{"pageTitle","The Hickeyian Way","role","assistant",',
    '"Here is a blog post in your style. # The Hickeyian Way\\n\\n',
    'Reality is already complicated enough. Stop tying things together that do not need to be tied together. ',
    'Most software development consists of taking separate concerns and braiding them into an inseparable knot. ',
    'The Hickeyian way starts by noticing that complexity is not the same thing as difficulty. ',
    'A thing can be difficult but simple. A thing can be easy but complex. ',
    'The software industry constantly chooses easy over simple and then spends years paying the interest. ',
    'This draft should be long enough to be treated as usable seed material for the commandbook extractor.",',
    '"Blog post for me go and read all of rich hickeys blog posts talk transcripts etc and create a summarise summarise his ideas in a sort of nice way. the hickeyian model / way of thinking"]'
  ].join('')

  return [
    '<!doctype html>',
    '<html>',
    '<head><title>ChatGPT - The Hickeyian Way</title></head>',
    '<body>',
    `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(stream)});</script>`,
    '</body>',
    '</html>'
  ].join('')
}
