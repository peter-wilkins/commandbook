# Runtime Events

Commandbook needs platform-neutral events.

Examples:

- `network.available`
- `network.lost`
- `wifi.available`
- `wifi.lost`
- `power.charging`
- `power.unplugged`
- `battery.low`
- `thermal.hot`
- `timer.due`
- `human.input.received`
- `run.stop_requested`

Events are how a runtime tells running coffee grinders that the world changed
without making every run poll constantly.

## What Events Are For

Events can:

1. Wake a paused run.
2. Update facts for a running run.
3. Trigger a new command run.
4. Cancel or stop part of a run.
5. Cause a scheduler to evaluate due work.

They should not turn Commandbook into a hidden always-on agent. Events are
delivery signals. Coffee grinders still own their goals, plans, permissions,
state, and recovery.

## Event Envelope

Events should be small and serializable.

```yaml
event_id: evt_2026_06_08_090000_wifi_available
type: wifi.available
at: "2026-06-08T09:00:00Z"
source: platform_network_driver
scope:
  device_id: current_phone
facts:
  network_kind: wifi
  metered: false
  internet_reachable: true
dedupe_key: wifi.available/current_phone/2026-06-08T09:00
```

Rules:

- Events are facts about something that happened or changed.
- Events should be cheap to store and inspect.
- Events should not contain secrets.
- Large payloads belong in local files with a reference.
- Event delivery must be at-least-once safe, so consumers need dedupe.

## Subscriptions

A run can declare the event types it is waiting for.

```yaml
waiting_for_events:
  - type: wifi.available
    reason: Upload local trip results when unmetered network returns.
  - type: human.input.received
    reason: Wait for Peter to confirm export.
```

This lets the runtime avoid waking every run for every event.

## Triggering New Runs

Some commands can be event-triggered.

```yaml
trigger:
  event_type: wifi.available
  command: flush_pending_uploads
  args:
    scope: current_device
```

V0 should require explicit trigger declarations. Do not let arbitrary events
launch arbitrary commands.

Triggering a new run still needs the same capability and approval checks as a
manually started command.

## Waking Paused Runs

Example water-trip flow:

```text
stop recording
  -> recording branch stops
  -> run status becomes paused_for_event
  -> waiting_for_events includes wifi.available
wifi.available arrives
  -> runtime finds matching paused runs
  -> coffee grinder resumes upload/export branch
```

This is different from a scheduler tick. A scheduler is time-driven. Runtime
events are world-driven.

## Bounded Delivery

The runtime should not append every event forever into every run.

Good run state:

```yaml
event_summary:
  received_count: 42
  last_event_id: evt_123
  last_matching_event:
    type: wifi.available
    at: "2026-06-08T09:00:00Z"
recent_events:
  max_items: 10
```

Detailed event history can live in a local event log:

```text
.commandbook/events/yyyy-mm-dd.jsonl
```

Runs should reference event ids when needed rather than copying full history into
their coffee-grinder state.

## Efficiency Rule

Events are the preferred way to avoid CPU burn between ticks.

Bad:

```text
while true:
  check network
  check battery
  check every run
```

Good:

```text
platform observes network callback
append network.available event
wake only runs subscribed to network.available
```

Each platform runtime can implement event observation differently. Commandbook
recipes only see the event model.

## First Slice

The first local event bus is implemented for the Linux simulator:

```bash
commandbook emit wifi.available --fact network_kind=wifi
commandbook list events
commandbook status <run-id>
commandbook simulate_water_trip_logger --network offline --yes
```

It proves:

1. A paused run can subscribe to `wifi.available`.
2. Emitting `wifi.available` wakes only that run.
3. Duplicate events are safe.
4. Event history stays bounded in the run state.

The simulated logger writes a local rich-location record first. If the live ping
path has no network, the run pauses with:

```yaml
status: paused_for_event
waiting_for_events:
  - wifi.available
  - network.available
```

When a matching event is emitted, Commandbook resumes the same run and completes
the pending upload branch.
