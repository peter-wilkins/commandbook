# Scheduled Runs And Interrupts

Commandbook should support repeated work, but this must stay narrow.

The water-trip logger does not need a Firebase-specific command or a new backend
inside Commandbook. It needs a few reusable operations plus a resumable schedule
pattern.

The command recipe must stay platform-neutral. Phone runtimes, server runtimes,
Linux cron, and browser PWAs can all implement scheduling differently. The
recipe should describe what should run and under what policy, not how a specific
operating system wakes up.

Every command should inherit a small set of global arguments. Keep this list
short.

```yaml
global_args:
  debug:
    default: false
    description: Record verbose coffee-grinder evidence for this run.
```

`debug=false` is important for phone efficiency. Normal runs should keep bounded
state and low-volume receipts. `debug=true` can retain extra evidence while
investigating a failure, but must not become the default.

## Useful Operations

### `get_location`

`get_location` is a query.

It reads the current location from the selected platform driver and produces a
location fact.

```yaml
name: get_location
kind: query
requires: []
provides:
  - current_location
capability_requirements:
  - capability_key: location/read_current
    scope_fact_keys:
      - device/id
    purpose: Read the current location sample.
driver_requirements:
  - location_driver
freshness:
  current_location: live
failure_cases:
  - location_permission_missing
  - location_unavailable
  - provider_disabled
```

### `http_post`

`http_post` is a mutation.

It sends a prepared payload to a configured endpoint and records a receipt.

```yaml
name: http_post
kind: mutation
requires:
  - endpoint_url
  - payload
effects:
  - remote_request_sent
provides:
  - response_status
  - response_body
  - sent_at
capability_requirements:
  - capability_key: network/post
    scope_fact_keys:
      - network/endpoint_url
    purpose: Upload the prepared payload.
driver_requirements:
  - http_driver
idempotency:
  strategy: idempotent
  key_facts:
    - endpoint_url
    - request_id
failure_cases:
  - network_unavailable
  - server_unavailable
  - request_rejected
```

For a location logger, the `request_id` should include the session id and
sequence number. That lets the receiver deduplicate backfilled uploads.

### `ensure_authenticated`

`login` should usually be represented as `ensure_authenticated`.

It is setup work, not the product command. It may be a query if a valid token
already exists, or a mutation if the system has to create or refresh local
credentials.

```yaml
name: ensure_authenticated
kind: mutation
requires:
  - auth_provider
  - required_scope
effects:
  - credential_available
provides:
  - auth_token_ref
capability_requirements:
  - capability_key: credential/manage_local
    scope_fact_keys:
      - auth/provider
      - auth/required_scope
    purpose: Ensure local credentials exist for later requests.
failure_cases:
  - human_login_required
  - token_expired
  - provider_unavailable
```

Secrets should be stored by the platform credential driver, not directly inside
the run JSON.

## Schedule Pattern

Do not store a JavaScript thunk in run state.

Queued work must be data. A scheduled run should store a command reference plus
arguments, because that can be checkpointed, inspected, and resumed after process
death.

```yaml
op: schedule_each
schedule:
  every_seconds: 60
  max_ticks: null
  stop_key: stop/water_trip_2026_06_08
children:
  - command: save_local_rich_location
    args:
      session_id: water_trip_2026_06_08
  - command: ping_server_location
    args:
      session_id: water_trip_2026_06_08
```

The scheduler owns timing and repetition. Child commands own the useful work.

Keeping local save and server ping separate is intentional. The local truth path
can continue even if the live upload path fails.

## Scheduler Inspiration

Two Clojure schedulers are useful references:

- Chime: https://github.com/jarohen/chime
- at-at: https://github.com/overtone/at-at

Chime's useful idea is that a schedule is a sequence of instants plus a callback.
That keeps the scheduler small and composable. Commandbook should borrow the
shape, but replace callback functions with serializable command references.

at-at's useful ideas are:

- one-off scheduling
- fixed-rate repetition
- fixed-delay repetition after the previous job completes
- stop versus kill
- named/described jobs that can be inspected

Commandbook should expose the policy explicitly:

```yaml
schedule:
  mode: fixed_rate
  every_seconds: 60
  overrun_policy: skip_if_previous_running
```

Other valid policies can be added when needed:

```yaml
overrun_policy:
  - skip_if_previous_running
  - queue_one
  - run_after_previous_finishes
  - fail_schedule
```

Do not invent cron syntax yet. Start with simple periodic schedules and named
policies.

World-driven wakeups such as `wifi.available` belong to the runtime event model,
not to scheduler syntax. See [`runtime-events.md`](runtime-events.md).

## Scheduler State

Minimum useful state:

```yaml
schedule_id: sched_123
status: running
every_seconds: 60
max_ticks: null
completed_ticks: 42
next_due_at: "2026-06-08T08:43:00Z"
last_started_at: "2026-06-08T08:42:00Z"
last_finished_at: "2026-06-08T08:42:02Z"
last_child_run_ids:
  save_local_rich_location: save_local_rich_location_42
  ping_server_location: ping_server_location_42
stop_key: stop/water_trip_2026_06_08
```

The scheduler should checkpoint:

- before sleeping
- after waking
- before starting a child command
- after the child command completes or fails
- when stop is requested

## Bounded State

A scheduled run must not grow forever.

The coffee grinder should keep counters, high-water marks, and recent summaries,
not every successful tick.

Good:

```yaml
completed_ticks: 420
failed_ticks: 3
last_successful_tick: 420
last_error_tick: 318
recent_ticks:
  max_items: 10
```

Bad:

```yaml
all_ticks:
  - tick_1_full_result
  - tick_2_full_result
  - ...
```

Detailed tick evidence belongs in child run records, local data files, or error
capsules. Once an error path is resolved, the schedule summary can be compacted
back down to counters and the final resolution.

This keeps the scheduler inspectable without turning one long-running coffee
grinder into a giant in-memory object.

## Scheduler Driver

The scheduler is a driver, not a special all-powerful coffee grinder.

Its job is to:

- calculate the next due time
- wake, emit `timer.due`, or be called by the platform runtime
- start bounded child command runs
- record summary state
- apply stop/overrun/error policy

It should not:

- hold every tick result in memory
- become a hidden backend
- know about Firebase, maps, or water trips
- silently retry forever without recording policy

## Interrupt Mechanism

V0 should use cooperative interruption.

Add a small command that writes a stop request into the run store:

```bash
commandbook stop <run-id>
```

That should set:

```yaml
interrupt:
  requested: true
  requested_at: "2026-06-08T08:45:00Z"
  reason: user_requested_stop
```

Long-running loops should check the run store before each tick. If stop is
requested, the run should checkpoint and move to `cancelled` or
`stopped_cleanly`.

`stop` applies to the targeted branch of the journey, not necessarily the whole
coffee-grinder run.

Example:

```text
stop recording
  -> stop the location/sensor recording branch
  -> keep the run open
  -> wait for Wi-Fi or human review
  -> upload/export results later
  -> finish after final verification
```

Use `cancel` for ending the whole run without completing the remaining graph.

Ctrl-C should do the same best-effort checkpoint locally:

```text
received SIGINT -> write interruption checkpoint -> exit
```

This is enough for the first local slice. Each platform runtime can map the same
idea to its own stop mechanism later.

## Water Trip Child Commands

The repeated child commands should stay small:

```yaml
command: save_local_rich_location
steps:
  - get_location
  - append_local_location_record
```

```yaml
command: ping_server_location
steps:
  - get_location
  - http_post_live_location
  - checkpoint_upload_receipt
```

The upload can fail without failing local capture. Local append is the truth
path. HTTP upload is only the live path.

## Scope Boundary

Build now:

- `get_location` with a fake Linux driver
- `http_post` with a fake or localhost driver
- `schedule_each`
- `commandbook stop`
- branch-level stop semantics
- simulated process death and resume

Do not build yet:

- Firebase-specific operation
- platform-specific phone wakeup implementation
- rich IMU logging
- map UI
- multi-user viewer

Those become justified after the scheduled local run model is boring and tested.

The test harness for this should use virtual time so long schedules do not run
in wall-clock time. See
[`test-time-and-event-scripts.md`](test-time-and-event-scripts.md).
