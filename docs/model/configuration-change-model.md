# Configuration Change Model

Configuration change is the abstract model behind tasks like:

- set ChatGPT as the default assistant
- make JobDone unrestricted for battery use
- change the default browser
- enable notifications for an app
- configure an email provider
- change a project setting in a web dashboard

This model is deliberately broader than Android Settings. Android Settings is
one configuration surface. A Linux settings panel, a CLI config file, a browser
preferences page, and a SaaS admin dashboard are also configuration surfaces.

## Granularity Decision

Do not make one giant user-facing command called `change_setting`.

Use this split:

```text
Specific command:
  set_default_assistant --assistant ChatGPT --scope current_phone

Reusable abstract operations:
  resolve_configuration_target
  find_configuration_route
  open_configuration_surface
  apply_configuration_change
  verify_configuration_state
  cache_configuration_route

Platform drivers:
  android_settings_driver
  linux_desktop_settings_driver
  browser_settings_driver
  web_dashboard_driver
```

The command should match what the user would naturally ask for. The operations
should be reusable across many commands. The driver should contain only the
platform-specific mechanics.

## Abstract Terms

### Configuration Target

The thing the user wants changed.

Examples:

- default assistant
- default browser
- app battery policy
- notification permission
- email sending provider
- project visibility

### Configuration Scope

Where the change applies.

Examples:

- current phone
- all Peter's Android devices
- current laptop user account
- debug Chrome profile
- JobDone team
- continuumkit.org Cloudflare account

### Configuration Subject

The entity being selected, configured, or affected by the target.

Examples:

- ChatGPT as the assistant
- JobDone as the app
- Brevo as the email provider
- Firefox as the browser

Some configuration targets do not need a separate subject.

### Desired State

The state the user wants after the command completes.

Examples:

- `default_assistant = ChatGPT`
- `battery_policy(JobDone) = unrestricted`
- `notifications(JobDone) = enabled`
- `email_provider = Brevo`

### Current State

The observed state before or after a change.

This may come from a query, a cached fact, UI inspection, an API read, or a
human confirmation.

### Configuration Surface

The place where the change can be made.

Examples:

- Android Settings screen
- iOS Settings page
- Linux settings panel
- config file
- web dashboard page
- CLI command
- API endpoint

### Configuration Route

The route to the configuration surface and the remaining steps needed to make
the change.

A route is not guaranteed to stay valid. Device updates, web redesigns, account
permissions, and feature flags can invalidate it.

### Configuration Mode

How much control the system is allowed to take.

Suggested first modes:

```yaml
open_only:
  description: Open or describe the right surface, but do not perform the change.

guided:
  description: Open the surface, keep the instruction card alive, pause for the human, then verify.

direct_if_safe:
  description: Perform the change only if the driver has explicit permission and proof it is safe.
```

V1 should usually use `guided`.

## Command Contract Shape

The specific user-facing command for the Android assistant example should be
something like this:

```yaml
name: set_default_assistant
intent: Make a chosen assistant app the default assistant for a scope.
arguments:
  assistant:
    required: true
    description: Assistant provider or app to set as default.
  scope:
    required: false
    default: current_device
    description: Device, account, team, or platform scope.
  mode:
    required: false
    default: guided
    description: open_only, guided, or direct_if_safe.
goal:
  facts:
    - configuration_target
    - configuration_scope
    - configuration_subject
    - desired_state
  effects:
    - configuration_change_guided
expected_capabilities:
  - inspect_configuration_state
  - find_configuration_route
  - open_configuration_surface
  - verify_configuration_state
trust_level: level_1
dry_run:
  must_show:
    - configuration_target
    - configuration_subject
    - configuration_scope
    - desired_state
    - mode
    - route
    - what_the_user_must_do
    - whether_direct_change_will_happen
constraints:
  - Do not silently change protected settings.
  - Do not use broad device control when a guided route is enough.
  - Do not assume one platform route works on another platform.
```

## Abstract Graph Contracts

### Query: `resolve_configuration_target`

Turns command arguments and natural language into canonical configuration facts.

```yaml
name: resolve_configuration_target
kind: query
requires:
  - command_arguments
provides:
  - configuration_target
  - configuration_scope
  - configuration_subject
  - desired_state
failure_cases:
  - ambiguous_configuration_target
  - unsupported_configuration_target
  - missing_required_argument
constraints:
  - Must not change external state.
  - Must preserve the user's words for inspection.
```

### Query: `find_configuration_route`

Finds the best known route to the place where the change can happen.

```yaml
name: find_configuration_route
kind: query
requires:
  - configuration_target
  - configuration_scope
  - desired_state
optional:
  - configuration_subject
  - current_state
  - platform_profile
  - learned_route_cache
provides:
  - configuration_surface
  - configuration_route
  - route_confidence
  - human_steps
failure_cases:
  - no_known_route
  - conflicting_routes
  - route_requires_choice
  - route_requires_setup
constraints:
  - Must not claim a cached route is permanent.
  - Must expose route confidence in the dry run.
```

### Mutation: `open_configuration_surface`

Opens or navigates to the closest safe configuration surface.

This is a mutation because it changes UI state, but it does not change the
target configuration value.

```yaml
name: open_configuration_surface
kind: mutation
requires:
  - configuration_surface
optional:
  - configuration_route
effects:
  - configuration_surface_opened
provides:
  - opened_surface
capability_requirements:
  - capability_key: configuration/open_surface
    scope_fact_keys:
      - configuration/surface
    purpose: Open the configuration surface without changing the setting.
approval:
  required: true
idempotency:
  strategy: idempotent
  recovery_clues:
    - opened_surface
    - foreground_app_or_page
constraints:
  - Must not change the target configuration value.
  - Must keep or restore the instruction card where possible.
```

### Blocking Resolver: `complete_human_configuration_step`

Pauses while the human performs a protected or ambiguous step.

This is a graph pause, not a query or mutation. It produces a human requirement
and later resumes with facts from the human.

```yaml
name: complete_human_configuration_step
node_type: blocking_resolver
requires:
  - configuration_route
  - human_steps
provides:
  - human_reported_done
  - optional_human_observation
failure_cases:
  - human_cancelled
  - route_no_longer_matches
  - human_needs_more_help
constraints:
  - Must keep the goal and next steps visible.
  - Must resume from a checkpoint rather than restart from memory.
```

### Mutation: `apply_configuration_change`

Performs the change directly.

This should be absent from many V1 plans. Use it only when the driver has narrow
permission, a testable direct mechanism, and a recovery strategy.

```yaml
name: apply_configuration_change
kind: mutation
requires:
  - configuration_target
  - desired_state
  - configuration_scope
optional:
  - configuration_subject
  - direct_configuration_api
effects:
  - configuration_changed
provides:
  - change_receipt
approval:
  required: true
idempotency:
  strategy: idempotent
  key_facts:
    - configuration_target
    - configuration_scope
    - configuration_subject
    - desired_state
failure_cases:
  - permission_denied
  - direct_change_not_supported
  - unsafe_without_human
constraints:
  - Must not be used when only UI-click automation is available.
  - Must verify or recover before retrying after interruption.
```

### Query: `verify_configuration_state`

Checks whether the desired state now appears to be true.

```yaml
name: verify_configuration_state
kind: query
requires:
  - configuration_target
  - desired_state
  - configuration_scope
optional:
  - configuration_subject
  - configuration_surface
provides:
  - current_state
  - verification_result
  - verification_confidence
failure_cases:
  - cannot_observe_state
  - state_conflicts_with_goal
  - verification_requires_human
constraints:
  - Must distinguish "verified", "not verified", and "cannot observe".
```

### Mutation: `cache_configuration_route`

Stores a route that worked for a particular scope/profile.

```yaml
name: cache_configuration_route
kind: mutation
requires:
  - configuration_route
  - configuration_scope
  - route_confidence
optional:
  - platform_profile
  - verification_result
effects:
  - configuration_route_cached
constraints:
  - Must include enough profile data to invalidate stale routes.
  - Must not treat a route as universal unless proven across scopes.
```

## Example: Set ChatGPT As Default Assistant

This is a specific command built from the abstract model.

```bash
set_default_assistant --assistant ChatGPT --scope current_phone
```

Run:

```text
1. Command arguments become initial facts.
2. Query resolves:
   configuration_target = default_assistant
   configuration_subject = ChatGPT
   configuration_scope = current_phone
   desired_state = default_assistant(ChatGPT)
3. Query identifies the platform profile for current_phone.
4. Query finds the best known configuration route.
5. Choice resolver pauses if there are several plausible routes.
6. Dry run shows the route and the human step.
7. Mutation opens the configuration surface.
8. Blocking resolver keeps the instruction card alive while the human chooses ChatGPT.
9. Query verifies the current assistant if possible, otherwise asks the human.
10. Mutation caches the route for this platform profile.
11. Command completes or records the unresolved gap.
```

## Granularity Rule

Use this rule when deciding whether something should be a specific command or a
generic operation:

```text
If the user would naturally ask for it by name, make it a command.
If many commands reuse the same step, make that step an operation.
If the step differs by platform, put the mechanics in a driver.
```

So:

```text
set_default_assistant        -> command
set_chatgpt_default_assistant -> possible shortcut/alias
find_configuration_route      -> query
open_configuration_surface    -> mutation
apply_configuration_change    -> mutation, direct only when safe
android_settings_driver       -> driver
```

This keeps the user surface small without making the operation layer too
specialised.
