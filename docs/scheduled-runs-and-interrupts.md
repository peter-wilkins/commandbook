# Scheduled Runs And Interrupts

Commandbook should support repeated work, but this must stay narrow.

The water-trip logger does not need a Firebase-specific command or a new backend
inside Commandbook. It needs a few reusable operations plus a resumable schedule
pattern.

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
capabilities:
  - read_location
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
capabilities:
  - network_post
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
capabilities:
  - manage_local_credentials
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
child:
  command: water_trip_tick
  args:
    session_id: water_trip_2026_06_08
```

The scheduler owns timing and repetition. The child command owns the useful work.

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
last_child_run_id: water_trip_tick_42
stop_key: stop/water_trip_2026_06_08
```

The scheduler should checkpoint:

- before sleeping
- after waking
- before starting a child command
- after the child command completes or fails
- when stop is requested

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

Ctrl-C should do the same best-effort checkpoint locally:

```text
received SIGINT -> write interruption checkpoint -> exit
```

This is enough for the first Linux slice. Android can map the same idea to a
stop button in the foreground-service notification later.

## Water Trip Tick

The repeated child command should stay small:

```yaml
command: water_trip_tick
steps:
  - get_location
  - append_local_location_record
  - http_post_live_location
  - checkpoint_upload_receipt
```

The upload can fail without failing the trip. Local append is the truth path.
HTTP upload is only the live path.

## Scope Boundary

Build now:

- `get_location` with a fake Linux driver
- `http_post` with a fake or localhost driver
- `schedule_each`
- `commandbook stop`
- simulated process death and resume

Do not build yet:

- Firebase-specific operation
- Android foreground service
- rich IMU logging
- map UI
- multi-user viewer

Those become justified after the scheduled local run model is boring and tested.
