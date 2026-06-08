# Coffee Grinder Run Model

The coffee grinder is the resumable loop around planning and execution.

It exists because real-world automation does not run in one clean pass. It hits
missing facts, missing permissions, setup work, credentials, payments, network
failures, human decisions, and partially completed side effects.

The coffee grinder should be local-first. It must not require a central backend
to run. A server or Postgres install may be one storage adapter, but the model
should also work in a browser, phone app, or Linux CLI with local durable
storage.

## Responsibilities

The coffee grinder owns:

- goal
- initial context
- known facts
- selected plan
- completed queries
- completed mutations
- in-progress mutations
- skipped or failed paths
- dry runs
- approvals
- setup graphs
- human requirements
- checkpoints
- final result

It also owns the boring but essential operation patterns: wait, poll, watch,
verify, recover, retry, timeout, and backoff.

The runtime event model is captured in
[`runtime-events.md`](runtime-events.md). Events let a coffee grinder sleep until
the world changes, rather than polling constantly.

## Flow

```text
1. Receive command and command arguments
2. Build initial context
3. Derive goal
4. Ask planner for a plan
5. Inspect required capabilities and setup requirements
6. Run safe queries
7. Prepare dry run for mutations
8. Pause for approval or missing human requirement
9. Run approved mutations
10. Checkpoint after meaningful progress
11. Recover in-progress mutations after interruption
12. Re-plan if facts changed or a path failed
13. Finish, pause, fail, or cancel
```

Common operation patterns are captured in
[`operation-patterns.md`](operation-patterns.md).

## Inputs

### Command

The user-facing command contract.

### Command Arguments

Named CLI-style inputs that become initial facts.

### Allowed Capabilities

The safety envelope for this run.

### Known State

Facts, installed drivers, credentials, permissions, and cached setup state
available at the start.

## Run State

The run state should be durable enough to survive process death.

Durability means "written through a run store", not "stored in a backend".

The first storage contract can be key-value shaped:

```text
key:   runs/<command>/<timestamp>_<short-id>
value: serialized coffee grinder state
```

Different platforms can choose different storage adapters:

- browser/PWA: localStorage for the smallest prototype, IndexedDB once values or
  history grow
- native phone: SQLite or files
- Linux CLI: JSONL/files or SQLite
- server install: Postgres/Supabase if that improves a particular deployment

Queued work should be stored as data, not function closures, so the state can be
serialized and resumed.

Minimum useful state:

```yaml
run_id: run_123
command: running_late
goal:
  effects:
    - message_sent
facts:
  contact: Cat
  destination: home
completed_queries:
  - current_location
  - estimate_travel_time
completed_mutations: []
in_progress_mutations: []
pending_mutations:
  - send_message
approvals:
  send_message: pending
human_requirements: []
failed_paths: []
status: paused_for_approval
```

For a local-first runner, this whole value should be enough to explain what the
run is doing and resume it after restart.

## Statuses

Suggested first-pass statuses:

- `planning`
- `running_queries`
- `paused_for_setup`
- `paused_for_human`
- `paused_for_event`
- `paused_for_approval`
- `running_mutations`
- `recovering`
- `replanning`
- `complete`
- `failed`
- `cancelled`

## Checkpoints

Checkpoint after:

- a mutation succeeds
- a human requirement is created
- approval is granted or denied
- setup state changes
- a path fails in a useful way
- the run pauses

Do not repeat completed mutations unless the mutation contract says it is safe
and idempotent.

Mutation contracts should declare their idempotency strategy. This is a major
input to recovery.

```yaml
idempotency:
  strategy: at_most_once
  key_facts:
    - command_run_id
    - recipient
    - message_text
```

The coffee grinder should treat `at_most_once` as "do not retry unless recovery
proves the mutation did not happen."

## Recovery

On restart after process death, the coffee grinder should recover before running
new mutations.

Recovery flow:

```text
1. Load last checkpoint.
2. Find any in-progress mutation.
3. Ask the selected driver to recover it.
4. Use the mutation idempotency strategy and recovery clues.
5. Record recovered facts/effects or failure.
6. If the outcome is unsafe or unknown, pause for a human requirement.
7. Re-plan from the recovered state.
```

Drivers do the platform-specific recovery work because only the driver knows how
to inspect the outside-world state.

Examples:

- SMS driver checks whether the exact message was sent.
- Email driver checks provider message ID or outbox state.
- Settings driver checks whether the target setting now has the desired value.
- File driver checks checksum and final path.

The coffee grinder must not blindly rerun a mutation after a crash.

## Capability Gaps

If no safe plan exists because a command, query, mutation, driver, setup graph,
verifier, or permission is missing, the coffee grinder can create a capability
gap.

A capability gap can become a builder-agent task.

See [`capability-gap-builder-loop.md`](capability-gap-builder-loop.md).

## Failure Capsules

If the world changes underneath a run, the coffee grinder should capture the
whole failure as a failure capsule.

The failure capsule is what lets capability agents fix the issue without losing
the user's original goal. It should be redacted and portable enough to compare
against open issues and PRs in the shared registry.

Capability agents should first check whether another user has already solved the
same failure before writing a new fix.

## Human Requirements And Choice Resolvers

The human's original request does not need to be precise.

If the human says "send an email" and no email driver is ready, the planner can
expand that into setup goals. If several setup paths are valid, the graph can
insert a choice resolver.

A choice resolver asks the human to pick from a useful set of choices, records
the answer as a fact, checkpoints, and resumes.

System-generated human requirements should be actionable.

Bad:

```text
Setup email.
```

Good:

```text
Which email provider should I set up?

Recommended: Brevo, because we already tested it for Tara.

Choices:
- Brevo: fastest route, needs API key.
- Cloudflare Email: keeps more inside Cloudflare, may need more setup.
- Gmail: familiar inbox, more OAuth complexity.
```

Human requirements should include:

- what is needed
- why it is needed
- where it will be used
- whether it is secret
- how to resume

Human requirements should carry a high planner cost.

The planner should prefer safe automatic routes over interrupting the human, but
human pause cost is not infinite. Some actions are safer or more honest when the
human performs the final step.

Final verification is different. Ending a graph with "Are you happy?" is a cheap
and useful feedback loop.

## Permission Model

The coffee grinder should inspect capability needs before execution.

Deno is useful inspiration here: outside-world access should be explicit and
narrow. Commandbook should distinguish:

- user approval
- command capability
- operation requirement
- driver platform permission
- runtime/environment permission

Example:

```text
send_message mutation
  requires capability: send_message
  driver permission: android.permission.SEND_SMS
  user approval: recipient + message_text dry run
```

## Replanning

Replanning is allowed when:

- a query produces unexpected facts
- a driver is unavailable
- setup succeeds and new operations become reachable
- a path fails
- the user supplies new facts

Replanning must not silently discard completed mutations or approvals.

## Design Rule

The coffee grinder is not a background magic agent.

It is a visible, resumable, inspectable run loop. It should always be able to
answer:

- What are we trying to do?
- What do we know?
- What have we already done?
- What are we about to do?
- What are we waiting for?
- What can safely happen next?
