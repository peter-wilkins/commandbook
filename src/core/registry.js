import { z } from 'zod'

const FACT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*\/[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/
const SIMPLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

export const NamespacedKeySchema = z
  .string()
  .regex(
    FACT_KEY_PATTERN,
    'Keys must look like namespace.segments/local_snake_case'
  )

export const SnakeCaseIdSchema = z
  .string()
  .regex(SIMPLE_ID_PATTERN, 'Ids must be snake_case')

export const FactKeySchema = NamespacedKeySchema
export const EffectKeySchema = NamespacedKeySchema
export const OperationIdSchema = NamespacedKeySchema

export const GraphEdgeSchema = z.object({
  edgeId: SnakeCaseIdSchema,
  requires: z
    .object({
      facts: z.array(FactKeySchema).default([])
    })
    .default({}),
  provides: z
    .object({
      facts: z.array(FactKeySchema).default([]),
      effects: z.array(EffectKeySchema).default([])
    })
    .default({})
})

export const ImplementationBindingSchema = z.object({
  bindingId: SnakeCaseIdSchema,
  edgeId: SnakeCaseIdSchema,
  operationId: OperationIdSchema
})

export const GapSignatureSchema = z.object({
  have: z
    .object({
      facts: z.array(FactKeySchema).default([])
    })
    .default({}),
  need: z
    .object({
      facts: z.array(FactKeySchema).default([]),
      effects: z.array(EffectKeySchema).default([])
    })
    .default({})
})

export function findGraphEdges(edges, signature) {
  const parsedSignature = GapSignatureSchema.parse(signature)
  const haveFacts = new Set(parsedSignature.have.facts)
  const neededFacts = new Set(parsedSignature.need.facts)
  const neededEffects = new Set(parsedSignature.need.effects)

  return edges
    .map((edge) => GraphEdgeSchema.parse(edge))
    .filter((edge) => providesNeededOutput(edge, neededFacts, neededEffects))
    .map((edge) => ({
      edge,
      missing: {
        facts: edge.requires.facts.filter((fact) => !haveFacts.has(fact))
      }
    }))
}

export function findImplementationBindings(bindings, { edgeId }) {
  SnakeCaseIdSchema.parse(edgeId)
  return bindings
    .map((binding) => ImplementationBindingSchema.parse(binding))
    .filter((binding) => binding.edgeId === edgeId)
}

function providesNeededOutput(edge, neededFacts, neededEffects) {
  return (
    edge.provides.facts.some((fact) => neededFacts.has(fact)) ||
    edge.provides.effects.some((effect) => neededEffects.has(effect))
  )
}
