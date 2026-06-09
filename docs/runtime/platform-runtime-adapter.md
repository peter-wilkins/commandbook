# Platform Runtime Adapter

A platform runtime adapter is the small host interface between the portable
Commandbook coffee grinder and a concrete runtime such as Linux, Android, a
browser, or a local service.

Drivers implement particular operations. The platform runtime adapter provides
the boring host services those drivers and runs need.

## Why This Exists

Without this boundary, the Commandbook core will slowly learn about Android,
Node, browsers, files, prompts, notifications, settings screens, and foreground
services.

That would make the coffee grinder hard to reuse.

The split is:

```text
Coffee grinder core
  knows: run context, queue, checkpoints, events, operation names

Platform runtime adapter
  knows: durable storage, clock, human prompts, platform events, surfaces

Drivers / operation handlers
  know: how to perform one operation in one environment
```

## Required Interface

Every platform runtime adapter must provide:

```js
{
  descriptor: {
    runtimeId: 'field_relay_android',
    platformId: 'android',
    capabilities: {}
  },
  clock: () => Date,
  runStore: {
    get: async (key) => unknown,
    put: async (key, value) => undefined,
    list: async (prefix) => string[],
    del: async (key) => undefined
  }
}
```

`clock` exists so tests can use virtual time.

`runStore` exists so every coffee-grinder run can survive process death.

## Optional Capability Groups

Adapters declare optional capability groups in their descriptor. If a group is
declared, the runtime must provide the methods for that group.

### Event Store

```js
capabilities: { eventStore: true }

eventStore: {
  append: async (event) => undefined,
  list: async () => event[]
}
```

Use for local event history.

### Human Prompt

```js
capabilities: { humanPrompt: true }

human: {
  prompt: async (requirement) => response
}
```

Use for missing facts, choices, approvals, credentials, and physical actions.

### Surface Open

```js
capabilities: { surfaceOpen: true }

surface: {
  open: async (request) => receipt
}
```

Use for opening Android settings, a browser URL, a file, or a native app
surface. Opening a surface is not proof that the human completed the change.

### Foreground Task

```js
capabilities: { foregroundTask: true }

foregroundTask: {
  start: async (request) => receipt,
  stop: async (taskId) => receipt
}
```

Use for bounded work that must be visible to the platform, such as an Android
foreground microphone capture.

### Package Inspection

```js
capabilities: { packageInspection: true }

packages: {
  isInstalled: async (packageQuery) => boolean
}
```

Use for setup commands such as `install_taptap`.

### Platform Events

```js
capabilities: { platformEvents: true }

events: {
  emit: async (event) => undefined
}
```

Use when the platform can notify Commandbook that something changed, such as
network availability, battery state, or a user action.

## Current Code Interface

The first code-level interface lives in:

```text
src/core/platform-runtime-adapter.js
```

It exports:

- `PlatformRuntimeAdapterDescriptorSchema`
- `PlatformRuntimeCapabilitiesSchema`
- `assertPlatformRuntimeAdapter`

This is deliberately small. It is a shape check, not a full framework.

## Field Relay Dogfood

Field Relay is the first Android dogfood for this interface.

For the capture-first slice, Field Relay needs:

```yaml
runtimeId: field_relay_android
platformId: android
capabilities:
  foregroundTask: true
  platformEvents: true
```

For the later `install_taptap` command, it will also need:

```yaml
capabilities:
  humanPrompt: true
  surfaceOpen: true
  packageInspection: true
```

The first Field Relay slice should not need the full Commandbook runner. It can
emit local events and follow this adapter shape so the future integration is
boring rather than a rewrite.

## Anti-Goals

- Do not put Android APIs in the coffee grinder core.
- Do not make every driver implement storage, prompts, and event delivery.
- Do not add a JS runtime to Android before the native capture loop proves it is
  needed.
- Do not require a backend to run commands.
