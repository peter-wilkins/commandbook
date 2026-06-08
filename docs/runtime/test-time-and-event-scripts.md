# Test Time And Event Scripts

Commandbook should be able to test long-running coffee grinders without waiting
for real time.

The model is inspired by Temporal's SDK test environments:

- https://docs.temporal.io/develop/typescript/testing-suite
- https://docs.temporal.io/develop/python/testing-suite
- https://docs.temporal.io/develop/go/testing-suite

The useful idea is not "copy Temporal". The useful idea is that test time is a
runtime concern. Recipes should describe waits, timers, schedules, and events.
The test harness can then fast-forward idle time and inject platform events.

## Rule

Test time must not leak into command recipes.

Good recipe language:

```yaml
schedule:
  every_seconds: 60
  max_ticks: null
waiting_for_events:
  - wifi.available
```

Bad recipe language:

```yaml
test_fast_forward: true
fake_now: tomorrow
```

The same recipe should run under:

- a real Linux clock
- an Android wakeup driver
- a browser/PWA timer driver
- a test clock

## Virtual Clock

The coffee grinder should read time through a clock adapter.

Production:

```text
clock.now() -> current wall-clock instant
clock.sleep_until(instant) -> platform sleep/wakeup
```

Test:

```text
clock.now() -> virtual instant
clock.sleep_until(instant) -> mark run idle until instant
```

When every active run is idle, the test harness can jump to the next due time.
That means a seven-day, one-minute schedule can be tested in milliseconds.

Example:

```text
start run at 2026-06-08T09:00:00Z
schedule every 60 seconds for 10,080 ticks
skip idle periods
assert completed_ticks == 10080
assert run state stays bounded
```

## Automatic Time Skipping

Automatic skip is useful for "run this whole workflow" tests.

Algorithm sketch:

```text
while runs are not complete:
  run every runnable coffee grinder until it blocks
  if all runs are idle:
    advance virtual clock to the earliest timer or scripted event
    emit due timers/events
```

Do not advance time while a driver operation is actively running. If a fake
driver wants to model a slow external operation, it should ask the test harness
to advance virtual time explicitly.

This mirrors Temporal's distinction between workflow timers and running
activities: timers can be skipped, outside-world work should remain visible.

## Manual Time Skipping

Manual skip is useful for intermediate assertions.

Example:

```text
start water trip logger
advance 25 hours
assert completed_ticks == 1500
assert recent_ticks.length <= 10
inject battery.low
assert recording branch stops or reduces work
advance until wifi.available
assert pending uploads flush
```

Manual skip should be the default when a test needs to inspect mid-run state.
Automatic skip is better for end-to-end completion tests.

## Event Scripts

Tests should inject runtime events at virtual times.

Example:

```yaml
start_at: "2026-06-08T09:00:00Z"
events:
  - at: "+15m"
    type: network.lost
    facts:
      network_kind: mobile
  - at: "+2h"
    type: battery.low
    facts:
      percent: 12
  - at: "+5h"
    type: wifi.available
    facts:
      network_kind: wifi
      internet_reachable: true
```

The harness should merge two streams:

1. Timer events from scheduled runs.
2. Scripted platform events from the test.

This lets us test phone-like behaviour without needing a phone in the loop.

## Property Tests

Once virtual time and event scripts exist, Commandbook can add property-style
tests around coffee-grinder runs.

The main liveness property:

```text
Given a valid recipe and valid initial arguments,
if every required fact, event, permission, and human decision eventually arrives,
then the coffee grinder eventually completes or reaches a justified safe terminal
state.
```

The property is not "every run always completes". Some runs should pause, fail,
or ask for help. The important property is that they do so visibly and for a
contractual reason.

Useful generated inputs:

- event order
- event duplication
- delayed facts
- missing facts that arrive later
- network loss and return
- process death between checkpoints
- driver success/failure receipts
- human approval, denial, or timeout
- scheduler tick counts and overrun timing

Useful invariants:

- no approved mutation runs more times than its idempotency contract allows
- a missing required fact pauses instead of guessing
- duplicate events do not duplicate side effects
- eventually supplied facts wake the waiting run
- bounded fields stay bounded during long schedules
- replay does not reinterpret old mutation receipts
- `debug=false` keeps normal run state compact
- terminal states are explainable from the run history

Property tests can start with generated event scripts and the built-in
`node:test` runner. Add a property-testing library only when the hand-written
generator becomes the bottleneck.

Candidate property shape:

```text
generate:
  initial facts
  event script
  fake driver receipts
  process-death points

run:
  execute under virtual time

assert:
  if required things eventually happened, status is complete
  if required things never happened, status is paused_for_event or paused_for_human
  no mutation receipt violates idempotency
  state size stays bounded
```

## Driver Fakes

Most tests should be integration tests around the real coffee grinder, run
store, recipe loading, event store, and CLI, with fake drivers at the edges.

Useful fakes:

- location driver with a fixed path or fixture route
- HTTP driver with planned success/failure responses
- network driver controlled by injected events
- battery driver controlled by injected events
- credential driver with "already logged in" and "human login required" modes

Fake drivers should record receipts just like real drivers.

## Replay Checks

Temporal uses workflow history replay to catch deterministic compatibility
problems after code changes. Commandbook should copy that shape.

Commandbook replay should take:

```text
recipe version
initial args
checkpoint/event history
fake driver receipts
```

Then it should re-run the planner/coffee-grinder orchestration and assert that
the same safe decisions are made.

Replay should not repeat outside-world mutations. It should reuse recorded
receipts for those steps.

First useful replay checks:

- A completed run can still be explained by current code.
- A paused run resumes to the same next step after a code change.
- A recipe change fails loudly if it would reinterpret old run state unsafely.

## Isolation

Virtual time can be shared state. Tests that need different clock behaviour
should use separate harness instances or run serially.

Good default:

- one isolated store directory per test
- one virtual clock per test
- one event script per test
- deterministic ids where possible

## Idle CPU Test

The test harness should also catch the phone-class bug where a runtime burns CPU
while waiting.

If all coffee grinders are idle and no driver is running, then:

```text
no polling loop should run
no repeated wakeups should happen
no run state should grow
```

This gives us a feedback loop for the phone warning Peter saw: the runtime must
sleep between events/timers instead of spinning.

## First Implementation Slice

Build only after the scheduler exists.

1. Add a `TestClock`.
2. Add an `EventScript` loader.
3. Add a harness that runs one command until complete, paused, or manually
   advanced.
4. Test the water-trip logger for a long virtual schedule.
5. Assert bounded run state and no idle polling.
6. Add the first property-style generated event-script test.

Do not build a general Temporal clone. Build the smallest harness that proves
Commandbook can test long schedules and injected events without real waiting.
