# Coffee Grinder Run Model

The coffee grinder is the resumable loop around planning and execution.

It exists because real-world automation does not run in one clean pass. It hits
missing facts, missing permissions, setup work, credentials, payments, network
failures, human decisions, and partially completed side effects.

## Responsibilities

The coffee grinder owns:

- goal
- initial context
- known facts
- selected plan
- completed queries
- completed mutations
- skipped or failed paths
- dry runs
- approvals
- setup graphs
- human requirements
- checkpoints
- final result

It also owns the boring but essential operation patterns: wait, poll, watch,
verify, retry, timeout, and backoff.

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
11. Re-plan if facts changed or a path failed
12. Finish, pause, fail, or cancel
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
pending_mutations:
  - send_message
approvals:
  send_message: pending
human_requirements: []
failed_paths: []
status: paused_for_approval
```

## Statuses

Suggested first-pass statuses:

- `planning`
- `running_queries`
- `paused_for_setup`
- `paused_for_human`
- `paused_for_approval`
- `running_mutations`
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

## Human Requirements

Human requirements should be precise.

Bad:

```text
Setup email.
```

Good:

```text
Create an API key in Brevo and paste it into BREVO_API_KEY.
```

Human requirements should include:

- what is needed
- why it is needed
- where it will be used
- whether it is secret
- how to resume

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
