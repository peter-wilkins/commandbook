import { z } from 'zod'
import { SnakeCaseIdSchema } from './registry.js'

export const PlatformRuntimeCapabilitiesSchema = z
  .object({
    eventStore: z.boolean().default(false),
    humanPrompt: z.boolean().default(false),
    surfaceOpen: z.boolean().default(false),
    foregroundTask: z.boolean().default(false),
    packageInspection: z.boolean().default(false),
    platformEvents: z.boolean().default(false)
  })
  .default({})

export const PlatformRuntimeAdapterDescriptorSchema = z.object({
  runtimeId: SnakeCaseIdSchema,
  platformId: SnakeCaseIdSchema,
  capabilities: PlatformRuntimeCapabilitiesSchema
})

export function assertPlatformRuntimeAdapter(adapter) {
  const descriptor = PlatformRuntimeAdapterDescriptorSchema.parse(adapter?.descriptor)

  assertFunction(adapter, 'clock')
  assertMethodGroup(adapter, 'runStore', ['get', 'put', 'list', 'del'])

  if (descriptor.capabilities.eventStore) {
    assertMethodGroup(adapter, 'eventStore', ['append', 'list'])
  }
  if (descriptor.capabilities.humanPrompt) {
    assertMethodGroup(adapter, 'human', ['prompt'])
  }
  if (descriptor.capabilities.surfaceOpen) {
    assertMethodGroup(adapter, 'surface', ['open'])
  }
  if (descriptor.capabilities.foregroundTask) {
    assertMethodGroup(adapter, 'foregroundTask', ['start', 'stop'])
  }
  if (descriptor.capabilities.packageInspection) {
    assertMethodGroup(adapter, 'packages', ['isInstalled'])
  }
  if (descriptor.capabilities.platformEvents) {
    assertMethodGroup(adapter, 'events', ['emit'])
  }

  return adapter
}

function assertMethodGroup(adapter, groupName, methodNames) {
  const group = adapter?.[groupName]
  if (!group) throw new Error(`Platform runtime adapter missing ${groupName}`)
  for (const methodName of methodNames) {
    if (typeof group[methodName] !== 'function') {
      throw new Error(`Platform runtime adapter missing ${groupName}.${methodName}()`)
    }
  }
}

function assertFunction(adapter, methodName) {
  if (typeof adapter?.[methodName] !== 'function') {
    throw new Error(`Platform runtime adapter missing ${methodName}()`)
  }
}
