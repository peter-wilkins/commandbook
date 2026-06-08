# Platform Notes: Android Wakeups

This is implementation research for a future Android runtime driver.

It is not part of the Commandbook recipe language. Recipes should say what
should run and under what schedule policy. Android-specific code decides how to
wake, run, checkpoint, and recover on Android.

## Is There A BIOS-Like Watchdog?

Not for ordinary apps.

There is no simple app-owned "BIOS" layer that is guaranteed to wake every
minute, inspect whether a foreground app is alive, and restart it forever.

Closest Android mechanisms:

- `AlarmManager`: system alarm service that can wake the app even when the app is
  not running, within Android's alarm rules.
- Foreground service: visible long-running work while the user is aware of it.
- `BOOT_COMPLETED` / package broadcasts: restart or reschedule after reboot or
  app update, subject to foreground-service restrictions.
- WorkManager: durable background work, but not precise one-minute work.
- User-controlled battery optimization exceptions: can improve survival but are
  not a normal invisible guarantee.

Official docs:

- https://developer.android.com/develop/background-work/services/alarms
- https://developer.android.com/reference/androidx/work/PeriodicWorkRequest
- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start

## Practical Reading

WorkManager periodic work is not suitable for "wake every minute". Its periodic
work has a 15 minute minimum interval and can be delayed by OS battery
optimizations.

AlarmManager can schedule work outside the app lifetime, but repeating alarms are
inexact on modern Android. Exact alarms are possible only for user-facing,
time-critical cases and come with permission and policy constraints.

A location foreground service is the likely active-trip runtime shape, but it
must be started from an appropriate user-visible state and needs the right
location permissions. Starting foreground services from the background is
restricted on recent Android versions, and location permissions have extra
while-in-use/background rules.

## Likely Water-Trip Runtime Shape

For a real trip:

```text
User presses Start Trip while app is visible.
App starts a location foreground service with persistent notification.
Service appends local truth records.
Service attempts live pings when network exists.
AlarmManager can be used as a coarse watchdog/resume prompt.
BOOT_COMPLETED reschedules recovery after reboot.
User presses Stop Trip from app or notification.
```

The local truth path should not depend on live upload.

If the OS kills the process, recovery should load the last local checkpoint and
either resume or ask the user. Do not hide uncertainty.

## Commandbook Boundary

Commandbook recipe:

```yaml
schedule:
  every_seconds: 60
  children:
    - save_local_rich_location
    - ping_server_location
```

Android runtime:

```text
foreground service + alarm/recovery strategy + permissions + notification
```

Keep these separate. Otherwise every useful command becomes accidentally Android
shaped.
