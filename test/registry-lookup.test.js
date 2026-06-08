import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FactKeySchema,
  GraphEdgeSchema,
  findGraphEdges
} from '../src/core/registry.js'

test('registry finds graph edges by namespaced fact signature', () => {
  const edges = [
    {
      edgeId: 'youtube_transcript',
      requires: {
        facts: ['youtube.video/id']
      },
      provides: {
        facts: ['youtube.video/transcript']
      }
    },
    {
      edgeId: 'local_video_transcript',
      requires: {
        facts: ['local.video/path']
      },
      provides: {
        facts: ['local.video/transcript']
      }
    },
    {
      edgeId: 'summarise_transcript',
      requires: {
        facts: ['youtube.video/transcript']
      },
      provides: {
        facts: ['generic.summary/text']
      }
    }
  ].map((edge) => GraphEdgeSchema.parse(edge))

  const matches = findGraphEdges(edges, {
    have: {
      facts: ['youtube.video/id']
    },
    need: {
      facts: ['youtube.video/transcript']
    }
  })

  assert.deepEqual(matches.map((match) => match.edge.edgeId), ['youtube_transcript'])
  assert.deepEqual(matches[0].missing.facts, [])
})

test('registry exposes missing facts for candidate gap fillers', () => {
  const edge = GraphEdgeSchema.parse({
    edgeId: 'brevo_email_send',
    requires: {
      facts: ['email.message/to', 'email.message/body']
    },
    provides: {
      effects: ['email.message/sent']
    }
  })

  const [match] = findGraphEdges([edge], {
    have: {
      facts: ['email.message/to']
    },
    need: {
      effects: ['email.message/sent']
    }
  })

  assert.equal(match.edge.edgeId, 'brevo_email_send')
  assert.deepEqual(match.missing.facts, ['email.message/body'])
})

test('generated namespaced fact keys stay searchable by exact namespace', () => {
  for (let index = 0; index < 50; index += 1) {
    const source = `source${index}.thing`
    const otherSource = `source${index}.other`
    const input = `${source}/id`
    const output = `${source}/label`
    const otherOutput = `${otherSource}/label`

    assert.equal(FactKeySchema.parse(input), input)
    assert.equal(FactKeySchema.parse(output), output)

    const edges = [
      GraphEdgeSchema.parse({
        edgeId: `source${index}_thing_label`,
        requires: { facts: [input] },
        provides: { facts: [output] }
      }),
      GraphEdgeSchema.parse({
        edgeId: `source${index}_other_label`,
        requires: { facts: [`${otherSource}/id`] },
        provides: { facts: [otherOutput] }
      })
    ]

    const matches = findGraphEdges(edges, {
      have: { facts: [input] },
      need: { facts: [output] }
    })

    assert.deepEqual(matches.map((match) => match.edge.edgeId), [`source${index}_thing_label`])
  }
})
