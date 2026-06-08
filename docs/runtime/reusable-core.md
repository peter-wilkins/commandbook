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

For Linux-first development, V0 can be a plain JavaScript script:

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

## V0 Language Choice

Use JavaScript first.

Reasons:

- less build noise while Peter is reading the code closely
- easier to run as a local script
- fewer generated artifacts and toolchain decisions
- fast enough to discover the real bug farms

Use comments and JSDoc where they reduce ambiguity:

- queue rewriting
- recovery and idempotency rules
- why a human pause is being created
- why a mutation is safe to retry or not safe to retry
- where the core must avoid platform APIs

Do not comment obvious assignments or wrap everything in types too early.

Bring in TypeScript later when one of these becomes true:

- adapter boundaries start drifting
- queue item shapes get hard to remember
- tests reveal shape bugs that types would catch
- the package becomes public enough that type contracts help users

## Boundary Schemas

Use Zod at serialized, plugin, and platform boundaries.

Zod schemas should be the source of truth. TypeScript types should be inferred
from those schemas rather than maintained separately.

Good boundary records:

```text
RunContext
QueueItem
CommandContract
OperationContract
DriverContract
PlatformRuntimeRegistration
CapabilityProvider
HumanRequirement
EventEnvelope
MutationReceipt
RecoveryResult
```

Use runtime validation when data crosses a trust or durability boundary:

- loading recipe files
- loading run state from storage
- receiving platform events
- registering drivers or capability providers
- reading mutation receipts
- accepting human requirement responses
- installing pieces from the shared registry

Keep ordinary runner logic simple. Do not add types everywhere just for style.
The proof value is at the boundaries where stale files, plugin code, platform
adapters, or shared registry entries can drift.

## Core Data Types

### RunContext

The whole current state of a run.

```js
/**
 * Whole serialized state of one command run.
 * Keep this plain data so a run can be stored, inspected, and resumed.
 */
const runContext = {
  runId: '2026-06-07T22-10-00.123Z_abcd1234',
  command: 'configure_git_identity',
  status: 'running',
  facts: {},
  goal: {},
  queue: [],
  stack: [],
  completed: [],
  inProgress: [],
  humanRequirements: [],
  approvals: {},
  receipts: [],
  failures: []
}
```

### QueueItem

The queued work item.

Queued work must be data, not a function closure.

```js
const queueItem = {
  op: 'query_git_identity',
  input: { scope: 'current_repo' },
  phase: 'enter'
}
```

### OperationHandler

The local implementation for a named query, mutation, or control step.

```js
/**
 * @param {object} ctx RunContext
 * @param {object} item QueueItem
 * @returns {Promise<object>} updated RunContext
 */
async function operationHandler(ctx, item) {
  return ctx
}
```

### RunStore

The durable storage boundary.

```js
const runStore = {
  async get(key) {},
  async put(key, value) {},
  async list(prefix) {},
  async del(key) {}
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

## Unplanned Issues

An unplanned issue is a condition discovered during a run that the recipe did
not explicitly handle.

Examples:

- git identity is missing
- a certificate is missing
- a driver is not installed
- a permission is denied
- a command line tool returns a known setup error

V0 behaviour:

1. Record the failure in the run context.
2. If the failure is recognized, update the current run queue.
3. Pause for the human only if needed facts or approvals are missing.
4. Resume the original mission after setup succeeds.
5. Do not edit the shared recipe automatically.

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

## Command Discoverability

The system will need a command registry, but V0 can keep it simple.

Start with a local folder:

```text
recipes/
  configure_git_identity.yaml
  git_push_current_branch.yaml
```

A registry entry should eventually answer:

- what command exists
- what it does
- what arguments it accepts
- what facts and effects it targets
- what capabilities it needs
- what setup commands it may trigger
- what platforms or drivers can run it
- what fact keys it requires
- what fact keys it provides
- what effects it can create
- what other registry entries can satisfy its missing inputs

Packaging compiled drivers is a separate design problem. For now, drivers are
local adapters referenced by recipe or operation name.

The registry should support Pathom-style reverse lookup by signature:

```text
have facts A+B, need fact C -> candidate providers
have fact X, want to know what is reachable -> candidate commands and queries
```

This is useful for both humans and agents. It powers command autocomplete, gap
agent search, and "why can't this run?" explanations.

The same registry shape should also support command-composed proof. A command
path can collect proof handles from the graph edges, drivers, safety policies,
and recovery rules it uses. See
[`command-composed-test-suites.md`](command-composed-test-suites.md).

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

```js
const runtimeAdapters = {
  store,
  handlers,
  clock,
  idGenerator,
  human,
  logger
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
      runner.js
      registry.js
      recipe.js
      costs.js
  adapters-file/
    src/
      FileRunStore.js
      ShellDriver.js
  cli/
    src/
      commandbook.js
recipes/
  configure_git_identity.yaml
  git_push_current_branch.yaml
```

For an even smaller first pass, this can live in one `src/` folder and be split
only when the seams prove useful.
