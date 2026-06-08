import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CapabilityGrantSchema,
  CapabilityRequirementSchema,
  CapabilityScopeBindingSchema,
  FactKeySchema,
  GraphEdgeSchema,
  ImplementationBindingSchema,
  OperationIdSchema,
  ScopeValueDigestSchema,
  ScopedCapabilityRequestSchema,
  findGraphEdges,
  findImplementationBindings
} from '../src/core/registry.js'

const DIGEST = `sha256:${'a'.repeat(64)}`

test('capability requirements keep power separate from runtime grants', () => {
  const requirement = CapabilityRequirementSchema.parse({
    capabilityKey: 'message/send',
    scopeFactKeys: ['contact/recipient', 'message/body'],
    purpose: 'Send the approved message.'
  })

  assert.deepEqual(requirement, {
    capabilityKey: 'message/send',
    scopeFactKeys: ['contact/recipient', 'message/body'],
    purpose: 'Send the approved message.'
  })

  assert.deepEqual(
    CapabilityRequirementSchema.parse({ capabilityKey: 'location/read_current' }),
    {
      capabilityKey: 'location/read_current',
      scopeFactKeys: []
    }
  )

  assert.throws(() =>
    CapabilityRequirementSchema.parse({
      capabilityKey: 'send_message',
      scopeFactKeys: ['contact/recipient']
    })
  )
})

test('scope value digests are lowercase sha256 hashes', () => {
  assert.equal(ScopeValueDigestSchema.parse(DIGEST), DIGEST)

  assert.throws(() => ScopeValueDigestSchema.parse('sha256:abc'))
  assert.throws(() => ScopeValueDigestSchema.parse(`sha256:${'A'.repeat(64)}`))
  assert.throws(() => ScopeValueDigestSchema.parse(`md5:${'a'.repeat(64)}`))
})

test('capability scope bindings tie grants to resolved fact digests', () => {
  const binding = CapabilityScopeBindingSchema.parse({
    factKey: 'contact/recipient',
    valueDigest: DIGEST
  })

  assert.deepEqual(binding, {
    factKey: 'contact/recipient',
    valueDigest: DIGEST
  })

  assert.throws(() =>
    CapabilityScopeBindingSchema.parse({
      factKey: 'recipient',
      valueDigest: DIGEST
    })
  )
})

test('scoped capability requests are runtime asks without grant state', () => {
  const request = ScopedCapabilityRequestSchema.parse({
    capabilityKey: 'message/send',
    scopeBindings: [
      {
        factKey: 'contact/recipient',
        valueDigest: DIGEST
      }
    ],
    purpose: 'Ask to send one scoped message.'
  })

  assert.deepEqual(request, {
    capabilityKey: 'message/send',
    scopeBindings: [
      {
        factKey: 'contact/recipient',
        valueDigest: DIGEST
      }
    ],
    purpose: 'Ask to send one scoped message.'
  })

  assert.deepEqual(
    ScopedCapabilityRequestSchema.parse({ capabilityKey: 'network/post' }),
    {
      capabilityKey: 'network/post',
      scopeBindings: []
    }
  )

  assert.throws(() =>
    ScopedCapabilityRequestSchema.parse({
      capabilityKey: 'send_message'
    })
  )
})

test('capability grants are active permissions without ledger status', () => {
  const grant = CapabilityGrantSchema.parse({
    grantId: 'tara_send_to_jane',
    capabilityKey: 'message/send',
    scopeBindings: [
      {
        factKey: 'contact/recipient',
        valueDigest: DIGEST
      }
    ],
    expiresAt: '2026-06-15T12:00:00.000Z'
  })

  assert.deepEqual(grant, {
    grantId: 'tara_send_to_jane',
    capabilityKey: 'message/send',
    scopeBindings: [
      {
        factKey: 'contact/recipient',
        valueDigest: DIGEST
      }
    ],
    expiresAt: '2026-06-15T12:00:00.000Z'
  })

  assert.deepEqual(
    CapabilityGrantSchema.parse({
      grantId: 'broad_network_post',
      capabilityKey: 'network/post'
    }),
    {
      grantId: 'broad_network_post',
      capabilityKey: 'network/post',
      scopeBindings: []
    }
  )

  assert.throws(() =>
    CapabilityGrantSchema.parse({
      grantId: 'tara-send-to-jane',
      capabilityKey: 'message/send'
    })
  )
  assert.throws(() =>
    CapabilityGrantSchema.parse({
      grantId: 'tara_send_to_jane',
      capabilityKey: 'message/send',
      expiresAt: 'next week'
    })
  )
})

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

test('implementation bindings link one graph edge to multiple operations', () => {
  const bindings = [
    ImplementationBindingSchema.parse({
      bindingId: 'youtube_transcript_api',
      edgeId: 'youtube_transcript',
      operationId: 'youtube.video/fetch_transcript_via_api'
    }),
    ImplementationBindingSchema.parse({
      bindingId: 'youtube_transcript_scrape',
      edgeId: 'youtube_transcript',
      operationId: 'youtube.video/fetch_transcript_via_page_scrape'
    }),
    ImplementationBindingSchema.parse({
      bindingId: 'local_video_transcript',
      edgeId: 'local_video_transcript',
      operationId: 'local.video/read_transcript_cache'
    })
  ]

  assert.equal(
    OperationIdSchema.parse('youtube.video/fetch_transcript_via_api'),
    'youtube.video/fetch_transcript_via_api'
  )

  const matches = findImplementationBindings(bindings, {
    edgeId: 'youtube_transcript'
  })

  assert.deepEqual(matches.map((binding) => binding.bindingId), [
    'youtube_transcript_api',
    'youtube_transcript_scrape'
  ])
})
