# Example: Android Settings Guided Change

This is the first end-to-end Commandbook example.

It comes from a real pain point: asking an assistant how to change an Android
setting, being told a settings path, then losing the path and the original goal
when switching between Assistant and Settings.

## Product Goal

Help the user change an Android setting without losing context.

The system should:

- remember what the user is trying to do
- find the best route for this device
- open the closest settings screen it safely can
- show the remaining steps persistently
- pause while the human does any required manual step
- verify or ask whether the setting changed
- cache the route for next time

This example also uses general operation patterns from Linux-style automation:
wait, poll, watch, verify, recover, timeout, and retry. See
[`operation-patterns.md`](../runtime/operation-patterns.md).

This is an Android-shaped instance of the abstract configuration change model.
See [`configuration-change-model.md`](../model/configuration-change-model.md).

## Granularity

`change_android_setting` is a useful developer/debug command because it lets us
test the generic machinery.

The user-facing command should usually be more specific:

```bash
set_default_assistant --assistant ChatGPT --scope current_phone
```

That specific command can still use the reusable configuration operations:

```text
resolve_configuration_target
find_configuration_route
open_configuration_surface
complete_human_configuration_step
verify_configuration_state
cache_configuration_route
```

The Android driver only owns the Android-specific mechanics.

## Driver Shape

Do not build one giant driver that knows every settings path for every Android
phone.

Use layers:

```text
generic_android_settings_driver
  + android_settings_intent_catalog
  + device_settings_profile
  + learned_route_cache
```

### Generic Android Settings Driver

Knows Android-level concepts:

- official Settings intents
- app package names
- device manufacturer/model/API level
- which settings are normally protected
- which routes may only open a screen rather than directly change a value

Android exposes many Settings activity actions for opening settings screens.
Official docs also warn that some matching activities may not exist on all
devices. That makes the generic layer useful but insufficient.

Sources:

- https://developer.android.com/reference/android/provider/Settings
- https://developer.android.com/reference/kotlin/android/provider/Settings.System

### Device Settings Profile

Knows the current phone's actual settings structure.

Example facts:

```yaml
device_manufacturer: Samsung
device_model: SM-G981B
android_api_level: 35
settings_app_package: com.android.settings
oem_skin: One UI
```

This profile can contain routes like:

```yaml
route:
  setting: app_battery_optimization
  target_app: JobDone
  steps:
    - Settings
    - Apps
    - JobDone
    - Battery
    - Unrestricted
```

### Learned Route Cache

Stores routes that worked before.

This is cached knowledge, not a permanent assumption. A system update or OEM UI
change can invalidate it.

## Is This A Mutation?

Changing the setting is a mutation.

Opening a settings screen is also a small side effect because it changes the
phone UI state, but it does not change the target system setting.

Use this split:

```text
Query: find_android_setting_route
Mutation: open_android_settings_screen
Human Requirement: toggle or choose the final setting
Query: verify_android_setting_state
Mutation: cache_android_setting_route
```

V1 should be a guided mutation, not silent direct control.

The user remains responsible for the final Android setting toggle unless a future
driver has explicit permission and proof that direct mutation is safe.

## Command Contract

```yaml
name: change_android_setting
intent: Help me change an Android setting without losing the route or context.
arguments:
  setting:
    required: true
    description: Natural phrase or canonical setting key.
  desired_state:
    required: false
    description: Desired value, if known.
  target_app:
    required: false
    description: App the setting applies to.
  device:
    required: false
    default: current_phone
    description: Device to guide.
  mode:
    required: false
    default: guided
    description: guided, open_only, or direct_if_safe.
goal:
  effects:
    - setting_change_guided
  facts:
    - setting_route
    - current_setting_state
    - desired_setting_state
expected_capabilities:
  - inspect_android_device
  - open_android_settings
  - cache_route
trust_level: level_1
dry_run:
  must_show:
    - setting
    - target_app
    - intended_route
    - what_the_user_must_do
    - whether_direct_change_will_happen
outputs:
  - setting_route
  - final_setting_state
  - route_cached
constraints:
  - Do not silently change protected Android settings.
  - Do not use accessibility clicks in V1.
  - Do not assume a Samsung route works on another device.
  - Keep the instruction card visible while the user is in Settings.
```

## Operation Contracts

### Query: `identify_android_device`

```yaml
name: identify_android_device
kind: query
requires:
  - device
provides:
  - device_manufacturer
  - device_model
  - android_api_level
  - settings_app_package
capability_requirements:
  - capability_key: android/inspect_device
    scope_fact_keys:
      - device/id
    purpose: Identify which Android settings route catalogue applies.
failure_cases:
  - device_not_connected
  - device_locked
```

### Query: `find_android_setting_route`

```yaml
name: find_android_setting_route
kind: query
requires:
  - setting
  - device_manufacturer
  - device_model
  - android_api_level
optional:
  - target_app
  - desired_state
provides:
  - setting_route
  - settings_intent
  - route_confidence
  - human_steps
capability_requirements:
  - capability_key: android/inspect_route_catalog
    scope_fact_keys:
      - android/device_model
      - android/api_level
      - configuration/target
    purpose: Find a likely settings route for this device and target.
failure_cases:
  - no_known_route
  - conflicting_routes
  - route_requires_human_confirmation
```

### Mutation: `open_android_settings_screen`

```yaml
name: open_android_settings_screen
kind: mutation
requires:
  - settings_intent
effects:
  - settings_screen_opened
provides:
  - opened_screen
capability_requirements:
  - capability_key: android/open_settings
    scope_fact_keys:
      - android/settings_intent
    purpose: Open the relevant settings screen without changing the setting.
dry_run:
  must_show:
    - settings_intent
    - expected_screen
approval:
  required: true
constraints:
  - Must not change the target setting.
  - Must leave the persistent instruction card available.
recover:
  strategy:
    - check_foreground_or_recent_settings_screen
    - reopen instruction card if needed
    - return needs_human if app focus cannot be determined
```

### Mutation: `cache_android_setting_route`

```yaml
name: cache_android_setting_route
kind: mutation
requires:
  - setting_route
  - device_manufacturer
  - device_model
  - android_api_level
effects:
  - route_cached
capability_requirements:
  - capability_key: android/cache_setting_route
    scope_fact_keys:
      - android/device_model
      - android/api_level
      - configuration/target
    purpose: Cache a verified route for this device profile.
dry_run:
  must_show:
    - route
    - device_profile
approval:
  required: false
constraints:
  - Must include device/profile metadata.
  - Must be invalidatable after OS or Settings app update.
```

## Coffee Grinder Run

Example invocation:

```bash
change_android_setting \
  --setting app_battery_optimization \
  --target-app JobDone \
  --desired-state unrestricted
```

Run:

```text
1. Command arguments become initial facts.
2. Query identifies the current Android device.
3. Query normalizes the setting phrase into a canonical setting key.
4. Query searches generic Android intents and the device profile.
5. Planner selects the best route.
6. Dry run shows the route and what will open.
7. User approves opening Settings.
8. Mutation opens the closest safe settings screen.
9. Coffee grinder pauses with a persistent instruction card.
10. It watches or polls for returning app focus if possible.
11. Human toggles the setting.
12. Coffee grinder verifies the state if possible, otherwise asks the human.
13. Mutation caches the route for this device profile.
14. Run completes.
```

## User-Visible Pause

The paused state should say:

```text
Goal: make JobDone unrestricted in battery settings.

I opened the closest settings screen I can.

Next:
1. Tap Battery.
2. Choose Unrestricted.
3. Come back and press Done.

I will remember this route for this phone.
```

## Why This Proves Commandbook

This example proves:

- assistant context survives app switching
- command arguments become initial facts
- queries discover device and route information
- mutation opens the settings screen
- human requirement pauses the graph
- wait/poll/verify patterns keep the run alive through app switching
- driver recovery handles process death without forgetting the goal
- coffee grinder resumes after the human step
- route knowledge becomes cached setup state
- the commandbook avoids broad silent device control

## Open Questions

1. Should `open_android_settings_screen` require approval every time, or only the
   first time per setting?
2. Should route caching be automatic after success?
3. Is `guided` the default mode forever, or only until we trust direct drivers?
4. What is the smallest useful UI for the persistent instruction card?
5. Should route verification rely on Android APIs, UI inspection, or human
   confirmation first?
