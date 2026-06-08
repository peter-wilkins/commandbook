import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
