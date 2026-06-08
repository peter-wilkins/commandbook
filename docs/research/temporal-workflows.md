# Research Note: Temporal Workflows

This is a research note, not a technology decision.

Sources:

- https://docs.temporal.io/
- https://docs.temporal.io/workflows
- https://docs.temporal.io/activities
- https://docs.temporal.io/develop/typescript/testing-suite
- https://docs.temporal.io/develop/go/testing-suite

## Why It Matters

Temporal is useful inspiration for the coffee grinder.

Temporal's core product idea is durable execution: a workflow can continue after
crashes, network failures, or infrastructure problems. Its docs describe
workflows as replaying from an event history, and activities as the place where
outside-world work happens.

The important product idea is not "use Temporal". The useful ideas are:

- event history as source of truth
- deterministic orchestration
- outside-world work isolated into activities
- activity results recorded so replay does not repeat work
- retries with policy
- timers and waits that survive process failure
- heartbeats/checkpoints for long-running activities
- signals/messages into running workflows
- test environments that skip idle timer periods
- event-history replay to catch determinism regressions

## Commandbook Mapping

| Temporal concept | Commandbook inspiration |
| --- | --- |
| Workflow | Coffee grinder run |
| Workflow Definition | Command contract plus run model |
| Workflow Execution | One command run |
| Activity | Driver `run` / operation execution |
| Event History | Checkpoint log |
| Activity retry | Retry operation pattern |
| Activity heartbeat | Long-running mutation checkpoint |
| Signal | Human requirement resolved or new facts supplied |
| Timer | Wait/timeout operation pattern |
| Test time skipping | Virtual clock test harness |
| Workflow history replay | Coffee-grinder checkpoint replay |

## Important Lesson

The coffee grinder should not rely on process memory.

After process death, it should recover from durable run state:

```text
checkpoint log + driver recover + idempotency strategy -> safe next state
```

## Difference From Temporal

Commandbook has a stronger user-safety problem than ordinary backend workflows.

Temporal can retry an activity if policy says so. Commandbook must additionally
ask:

- Is this mutation allowed by the command?
- Did the user approve this exact side effect?
- Is the mutation idempotent or at-most-once?
- Can the driver prove what happened after process death?
- Should the system pause for human recovery instead of retrying?

## Design Rule

Treat Temporal as workflow-resilience inspiration, not as a required dependency.

The coffee grinder should copy the shape of durable thinking:

```text
visible run state
event/checkpoint history
driver recovery
idempotency strategy
human signals
safe retries
```

Do not import Temporal vocabulary wholesale if Commandbook language is clearer.

Temporal-style testing guidance for Commandbook is captured in
[`../runtime/test-time-and-event-scripts.md`](../runtime/test-time-and-event-scripts.md).
