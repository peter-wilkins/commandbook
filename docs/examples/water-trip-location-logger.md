# Example: Water Trip Location Logger

This example was seeded from the local ChatGPT capture:

```text
/home/peter/workflow-manager/local/source-captures/live-gps-tracking-linux-chatgpt.txt
```

The core idea is a reliable water-trip tracker that records location and sensor
data during a session, keeps working through runtime/network trouble, and can
export the truth afterwards.

## Why This Is A Good Commandbook Test

This is a stronger resumability test than `configure_git_identity`.

It needs:

- scheduled wakeups
- local durable state
- platform runtime execution
- network retry and backfill
- session checkpoints
- sequence numbers
- recovery after app/process death
- final human verification
- separate live and rich local recording paths

It also has real product value: watersports safety, later trip replay, and future
downwinding skill analysis.

## Command Shape

Possible command:

```bash
start_water_trip_logger --mode live-plus-local --interval 60s
```

Goal:

```yaml
facts:
  - active_trip_session
  - local_track_file
effects:
  - gps_points_recorded
  - live_points_uploaded_when_possible
  - session_export_available
```

## V0 Architecture

Use two paths:

```text
Live path:
  tiny GPS ping every 60 seconds
  sequence number
  phone timestamp
  optional server/Firebase timestamp
  retry/backfill marker

Truth path:
  local files on the phone
  richer GPS and sensor data
  export after the session
```

The live path is for "can someone see roughly where I am?" The truth path is for
analysis and evidence later.

Do not make the live path carry high-rate sensor data.

The reusable pieces are captured in
[`../scheduled-runs-and-interrupts.md`](../scheduled-runs-and-interrupts.md).
The important split is:

```text
get_location -> query
append local record -> local mutation
http_post -> remote mutation
schedule_each -> runner pattern
stop -> cooperative interrupt
```

## Platform Runtime Note

The command recipe should not depend on Android, Firebase, Tailscale, or any
other concrete implementation.

The runtime question is separate:

```text
Can this platform wake reliably often enough, run the child commands, checkpoint,
and recover after process death?
```

On phones, this will need platform-specific research and testing. Keep that in a
runtime note or driver doc, not in the command recipe.

Relevant Android docs:

- https://developer.android.com/guide/background/persistent/getting-started/define-work
- https://developer.android.com/reference/androidx/work/PeriodicWorkRequest
- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://developer.android.com/develop/sensors-and-location/location/background

These links are implementation input for a later phone driver, not part of the
Commandbook recipe contract.

Android wakeup notes are kept separately in
[`../platform-android-wakeup-notes.md`](../platform-android-wakeup-notes.md).

## Local Files

Suggested first files:

```text
session.jsonl
gps.csv
live_uploads.jsonl
events.jsonl
```

Later:

```text
imu.csv
barometer.csv
network.jsonl
```

MVP record:

```json
{
  "seq": 152,
  "phoneTime": "2026-06-08T07:00:00Z",
  "elapsedRealtimeNanos": 123456789000,
  "lat": 50.6,
  "lon": -2.4,
  "accuracy": 8,
  "speed": 3.1,
  "heading": 240,
  "batteryPercent": 72,
  "network": "mobile",
  "uploadState": "queued"
}
```

## Live Upload Options

### Local laptop over Tailscale

Good for a local experiment.

```text
Phone app -> HTTP POST -> laptop tailnet server -> JSONL
```

Weakness: Tailscale becomes part of the reliability test. If Tailscale sleeps or
drops, the live path fails even if normal internet might have worked.

### Firebase Realtime Database

Good for an MVP with less server work.

```text
Phone app -> Firebase Realtime Database -> viewer/export later
```

Firebase can help with offline writes and later sync, but backfilled sync is not
the same as live visibility. Records still need phone time, sequence number, and
upload/backfill status.

Use rules/auth. Do not leave a public unauthenticated write endpoint.

## Coffee Grinder Run

```text
1. Create session id.
2. Check permissions and foreground service readiness.
3. Create local session files.
4. Start foreground tracking service.
5. Every tick:
   a. collect location
   b. run save_local_rich_location
   c. run or enqueue ping_server_location
   d. checkpoint run state
6. Upload loop:
   a. send queued live points when network exists
   b. record success/failure/backfill status
   c. checkpoint after each useful result
7. On process restart:
   a. load active session
   b. inspect foreground service / notification state
   c. resume local capture if safe
   d. continue upload queue
8. On stop:
   a. close session
   b. export GPX/GeoJSON/CSV
   c. ask "Are you happy?"
```

## Run State

Minimum useful state:

```yaml
run_id: water_trip_2026_06_08_0700
command: start_water_trip_logger
status: running
facts:
  session_id: water_trip_2026_06_08_0700
  interval_seconds: 60
  local_session_dir: /phone/storage/...
  last_seq: 152
  last_local_write_seq: 152
  last_live_upload_seq: 148
  upload_backlog_count: 4
queue:
  - schedule_each
  - flush_live_uploads
receipts:
  - local_record_written
  - live_record_uploaded
failures:
  - network_unavailable
```

## Recovery Questions

After restart, the runner should be able to answer:

- Is there an active session?
- Was the foreground service still alive?
- What was the last local sequence written?
- What live uploads are still queued?
- Did the clock jump?
- Did location permission change?
- Did battery optimization kill us?
- Is the user still on the trip?

If the state is ambiguous, pause with a human requirement:

```text
I found an unfinished water trip session.

Last local point: 07:42
Last live upload: 07:39

Resume tracking?
```

## Sensor Strategy

Start low-rate:

```text
GPS: 1 point every 60 seconds for live path
GPS truth path: optionally 1 Hz
network upload status: every upload attempt
```

Add rich sensors only after the live path is reliable:

```text
barometer: 5-10 Hz
accelerometer/gyro: 25-50 Hz
orientation: when changed or low rate
```

High-rate sensor data should be local-only during the session, then exported.

## First Build Slice

Do not start by building the phone app.

First Commandbook slice:

```text
simulate_water_trip_logger
```

It can run on Linux and simulate:

- one-minute ticks
- local append
- upload success/failure
- process death
- recovery
- final export

Then move the same run model into a phone runtime once the state machine is
boring.

This follows the same rule as the git identity example: prove the coffee grinder
locally before fighting phone deployment and battery policy.

The first slice should prove interruption too:

```text
start simulated logger
wait for two ticks
request stop
verify final checkpoint says stopped_cleanly
resume command
verify it does not restart unless explicitly asked
```
