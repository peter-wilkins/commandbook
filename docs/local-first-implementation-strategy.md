# Local-First Implementation Strategy

Commandbook should not require a central backend to run.

The commandbook is closer to a bootable installation disk than a SaaS workflow
service. The recipe can be shared, but each run happens locally and adapts to
the actual device, permissions, installed tools, user choices, and partial
failures it encounters.

## Architecture Direction

```text
GitHub / shared registry
  publishable command recipes
  query and mutation contracts
  driver contracts
  tests and fixtures

Local runtime
  command runner
  planner
  coffee grinder
  platform drivers
  local durable run store

Platform storage adapter
  browser: localStorage or IndexedDB
  native phone: SQLite or files
  Linux CLI: JSONL/files or SQLite
  server install: Postgres if useful, but not required
```

GitHub is for distribution and collaboration. It is not the execution backend.

The reusable core boundary is described in
[`reusable-core.md`](reusable-core.md).

## Run Store

The coffee grinder only needs a durable key-value shaped store at first.

Example:

```text
key:
  runs/set_default_assistant/2026-06-07T21-30-45.123Z_abcd1234

value:
  serialized coffee grinder state
```

The value should be pure data:

```yaml
run_id: 2026-06-07T21-30-45.123Z_abcd1234
command: set_default_assistant
status: paused_for_human
facts:
  configuration_target: default_assistant
  configuration_subject: ChatGPT
  configuration_scope: current_phone
  desired_state: default_assistant(ChatGPT)
queue:
  - verify_configuration_state
completed:
  - resolve_configuration_target
  - find_configuration_route
  - open_configuration_surface
human_requirements:
  - id: choose_default_assistant
    prompt: Choose ChatGPT as the default assistant, then come back and press Done.
receipts: []
failures: []
```

The storage API can stay tiny:

```ts
interface RunStore {
  get(key: string): Promise<unknown | null>
  put(key: string, value: unknown): Promise<void>
  list(prefix: string): Promise<string[]>
  del(key: string): Promise<void>
}
```

Local storage choices:

- `localStorage`: fastest possible browser/PWA prototype, but small and clumsy.
- `IndexedDB`: better browser/PWA run history and larger values.
- SQLite: best local native and CLI store once state queries matter.
- JSONL/files: excellent Linux-first debugging format.
- Postgres/Supabase: optional install target, not a required backend.

## Coffee Grinder Shape

Coffee grinders are the right mental model:

```text
context + work queue + runner
```

The important implementation choice is to store queued work as data, not opaque
functions. That makes runs serializable, inspectable, restartable, and testable.

Good:

```yaml
queue:
  - op: find_configuration_route
    input:
      configuration_target: default_assistant
```

Bad:

```text
queue:
  - JavaScript function closure
```

The runner can map operation names to local implementations at runtime.

## Pathom Strategy

Pathom has the right ideas:

- attributes/facts
- resolvers/queries
- indexes
- planner
- runner
- mutations
- async processing

But making Pathom a runtime dependency probably makes the first deliverable too
large and too Clojure-shaped.

Use this strategy instead:

1. Keep borrowing the mental model and tests.
2. Implement a minimal TypeScript planner for Commandbook's subset.
3. Keep compatibility fixtures inspired by Pathom examples.
4. Optionally run Pathom locally as a golden-master oracle during development.
5. Do not ship ClojureScript/Pathom in the first browser or phone bundle.

The goal is not to reimplement all of Pathom. The goal is to copy the few
planner behaviours Commandbook actually needs:

- given known facts, find reachable desired facts or effects
- prefer lower-cost paths
- support OR paths when several routes can satisfy the same goal
- expose why no path exists
- keep mutation planning safety-aware

## Statecharts Strategy

Statecharts are useful for the outside lifecycle:

```text
created
planning
running
paused_for_human
paused_for_approval
recovering
complete
failed
cancelled
```

They are less useful as the planner itself.

Do not add XState or Stately until the lifecycle becomes difficult enough to
justify the dependency. The coffee grinder can start as a small explicit reducer
over run state.

## Human Requirements

Human pauses should be expensive in planning.

Suggested first cost model:

```yaml
direct_verified_query: 1
cached_safe_route: 2
safe_local_mutation: 4
guided_surface_open: 8
human_pause: 25
manual_vague_instruction: 50
unknown_or_unsafe: blocked
```

The human can still be the final verifier.

Every graph can end with:

```text
Are you happy?
```

That is different from interrupting the human halfway through a run. Final
verification is healthy feedback. Mid-run interruption should be avoided unless
it is the safest or only useful path.

## First Target Platform

Linux should be the first target platform.

Reasons:

- no APK deployment loop
- no OEM Android settings fragmentation
- easy file and process inspection
- easy local fixtures
- easy command-line drivers
- faster red/green testing

Android remains a strong product target, but Linux is a better implementation
target for proving the coffee grinder and planner.

## Recommended First Command

Use a boring Linux configuration command:

```bash
configure_git_identity --scope current_repo
```

Why this is a good first slice:

- queries can inspect existing Git config
- missing name/email becomes a human requirement
- mutation writes local repo config only
- verification is simple
- recovery is simple
- no phone deployment
- no root permissions
- no central backend

Possible run:

```text
1. Read command arguments.
2. Query current repo path.
3. Query git user.name and user.email for the repo.
4. If missing, ask the human for values.
5. Dry run: show exact config keys and values to write.
6. On approval, run git config mutations.
7. Verify with git config --get.
8. Ask: Are you happy?
9. Store final run state locally.
```

This proves the same core mechanics needed later for Android settings:

- local run state
- facts
- queries
- mutations
- human requirements
- approvals
- verification
- recovery
- receipts

## What Not To Build Yet

Do not start with:

- central hosted execution
- Supabase as required runtime state
- a general agent planner
- full Pathom compatibility
- Android direct UI automation
- XState as a mandatory dependency

Only add those when a local-first Linux slice proves the pain.
