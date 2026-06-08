# Command-Composed Test Suites

Commandbook should not assume "run every test in the whole project" is the only
useful proof loop.

As a project grows, the full-suite model can become slow, flaky, and rarely
green. When that happens, agents stop getting fast feedback and humans stop
trusting the signal.

Commandbook can do better because commands already have contracts.

## Core Idea

Each command, graph edge, driver, setup graph, verifier, and safety policy should
advertise its own proof handles.

Then an agent can compose the test suite the same way the planner composes a
command:

```text
planned command path
  -> involved graph edges
  -> involved drivers
  -> involved safety policies
  -> involved recovery/idempotency rules
  -> relevant tests
  -> quick proof run
```

The result is not "everything in the repo is green".

The result is:

```text
This command probably works because the tests for the pieces it uses passed.
```

That is a more honest signal.

## Proof Handle

A proof handle is a reference to a test, replay fixture, property, simulator, or
manual verification that supports a commandbook piece.

Examples:

```yaml
edge_id: youtube_transcript
proof:
  tests:
    - test/registry-lookup.test.js
  properties:
    - given youtube.video/id eventually produces youtube.video/transcript or a visible pause
```

```yaml
driver_id: android_share_receiver
proof:
  tests:
    - phone-control-surface-android/app/src/androidTest/...
  simulator:
    - inject ACTION_SEND with zip fixture
```

Proof handles should stay small and specific.

## Test Composition

Given a selected plan, the test composer should collect:

- command contract tests
- graph edge tests
- driver fake tests
- safety policy tests
- recovery tests for mutation-capable drivers
- event-script tests for scheduler/event behaviour
- replay fixtures for old run histories touched by the change

This is the testing equivalent of a reachability index:

```text
What proof is reachable from the pieces used by this command?
```

See the visual version in
[`../model/registry-schema-diagrams.md`](../model/registry-schema-diagrams.md).

## Output To Human

The agent should report proof in plain language:

```text
Probably works.

Checked:
- graph edge lookup for youtube.video/id -> youtube.video/transcript
- fake HTTP driver success and network failure paths
- duplicate event does not duplicate mutation receipt

Not checked:
- live YouTube page drift
- Android background process death
```

This is better than a vague "tests passed" because it says what was actually
proved.

## Relationship To Full CI

Full CI still has value:

- release gate
- nightly health check
- shared registry merge gate
- broad regression scan

But day-to-day agent work should prefer command-composed proof:

```text
small change -> relevant proof now -> human gets fast confidence
```

Then slower full CI can run separately without blocking every thought loop.

## Property Tests

Property tests fit this model well.

For a command path, generate:

- event order
- duplicated events
- delayed facts
- missing facts that eventually arrive
- process death points
- driver success/failure receipts

Then assert:

```text
if required facts/events/approvals eventually arrive,
the coffee grinder completes or reaches a justified safe terminal state.
```

This lets agents throw a lot at one command without pretending they tested every
other command in the system.

## First Slice

Start small:

1. Let graph edges declare proof handles.
2. Add a CLI later: `commandbook test-plan <command>`.
3. Print the test files/properties that should run for that command.
4. Run them and produce a "probably works" report.

Do not build a general CI replacement yet. Build proof composition for one
command path first.
