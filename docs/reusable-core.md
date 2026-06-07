# Reusable Core

The first Commandbook implementation can be "just a script" if the reusable core
is kept small, data-first, and platform-neutral.

The core should not know whether it is running in a Linux CLI, browser PWA,
Android app, or server process. Platform-specific code belongs in adapters.

## Core Shape

```text
Command recipe
  -> initial RunContext
  -> planner/recipe expander
  -> coffee grinder runner
  -> operation handlers
  -> driver adapters
  -> run store checkpoint
```

The portable core is:

1. Data types
2. Run store interface
3. Operation registry
4. Planner or recipe expander
5. Coffee grinder runner
6. Human requirement model
7. Effect and receipt model
8. Recovery hooks

Everything else is an adapter.

## V0 Can Be A Script

For Linux-first development, V0 can be a TypeScript script:

```bash
commandbook configure_git_identity --scope current_repo
```

Storage can be plain files:

```text
.commandbook/
  runs/
    configure_git_identity/
      2026-06-07T22-10-00.123Z_abcd1234.json
  receipts/
  logs/
```

This is enough to prove:

- state survives process death
- runs can pause and resume
- the user can inspect what happened
- failed paths can be recorded
- a later platform can swap storage without changing the runner

## Core Data Types

### RunContext

The whole current state of a run.

```ts
type RunContext = {
  runId: string
  command: string
  status: RunStatus
  facts: Record<string, unknown>
  goal: Goal
  queue: QueueItem[]
  stack: QueueItem[]
  completed: CompletedStep[]
  inProgress: InProgressStep[]
  humanRequirements: HumanRequirement[]
  approvals: Record<string, ApprovalState>
  receipts: Receipt[]
  failures: Failure[]
}
```

### QueueItem

The queued work item.

Queued work must be data, not a function closure.

```ts
type QueueItem = {
  op: string
  input?: Record<string, unknown>
  phase?: 'enter' | 'leave' | 'recover'
}
```

### OperationHandler

The local implementation for a named query, mutation, or control step.

```ts
type OperationHandler = (ctx: RunContext, item: QueueItem) =>
  Promise<RunContext>
```

### RunStore

The durable storage boundary.

```ts
interface RunStore {
  get(key: string): Promise<unknown | null>
  put(key: string, value: unknown): Promise<void>
  list(prefix: string): Promise<string[]>
  del(key: string): Promise<void>
}
```

V0 implementation: files.

Later adapters:

- browser localStorage
- browser IndexedDB
- Android SQLite
- JSONL files
- optional Postgres

## Pedestal Interceptor Inspiration

Pedestal interceptors are useful prior art because they use a context map,
interceptor queue, and stack. Interceptors can add work to the queue, terminate
early, and participate in enter/leave/error phases.

Commandbook should borrow the mechanism, not the HTTP vocabulary.

Commandbook equivalent:

```text
Pedestal context -> RunContext
Pedestal queue   -> queue of planned operations
Pedestal stack   -> stack of entered operations for leave/recovery
enter            -> run operation
leave            -> verify/cleanup/receipt
error            -> recover or enqueue setup
```

The key idea is that a step may update the rest of the run.

## Self-Updating Run Example

Original task:

```bash
git_push_current_branch
```

Run:

```text
1. Query current repo.
2. Mutation tries git push.
3. Push fails because git identity is not configured.
4. Failure handler recognizes missing setup.
5. It prepends configure_git_identity setup steps.
6. Coffee grinder pauses for missing name/email if needed.
7. Human supplies facts.
8. Mutation writes git config.
9. Verification checks git config.
10. Original git push is re-enqueued.
11. Run continues original mission.
```

The command recipe did not need to know every setup problem ahead of time. The
run context evolved when the failure made a missing requirement visible.

This is different from silently editing the shared recipe. V0 should only update
the current run. If the pattern proves reusable, the system can later propose a
recipe patch for the shared registry.

## Recipe Update Rule

Runs may update themselves.

Shared recipes should update only after proof.

Suggested rule:

```text
First occurrence:
  update current run only

Repeated or tested occurrence:
  propose a local recipe patch

Useful across machines/users:
  propose a shared registry patch
```

This keeps the system adaptive without letting one weird failure permanently
pollute the commandbook.

## Planner V0

Do not start with a general planner.

Start with recipe expansion:

```text
command name + facts -> initial queue
```

Then add two small planner behaviours:

1. If a step fails with a recognized missing requirement, enqueue the setup
   command before retrying.
2. If several operations can provide the same fact, choose the lowest-cost
   available route.

That is enough to get the interceptor feel without building full Pathom.

## Portable Core Boundary

The core must not call:

- `fs`
- `localStorage`
- IndexedDB
- SQLite
- shell commands
- Android APIs
- browser DOM APIs

The core receives these as adapters:

```ts
type RuntimeAdapters = {
  store: RunStore
  handlers: OperationRegistry
  clock: Clock
  idGenerator: IdGenerator
  human: HumanAdapter
  logger: Logger
}
```

That lets the same core run in:

- Linux CLI with file storage and shell handlers
- browser PWA with IndexedDB and web handlers
- Android app with SQLite and Android intent handlers
- tests with memory storage and fake handlers

## Suggested Initial File Layout

```text
packages/
  core/
    src/
      types.ts
      runner.ts
      registry.ts
      recipe.ts
      costs.ts
  adapters-file/
    src/
      FileRunStore.ts
      ShellDriver.ts
  cli/
    src/
      commandbook.ts
recipes/
  configure_git_identity.yaml
  git_push_current_branch.yaml
```

For an even smaller first pass, this can live in one `src/` folder and be split
only when the seams prove useful.
