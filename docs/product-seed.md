# Product Seed: Commandbook

Captured from ChatGPT conversation: `Waterproof Case`

Local raw source:

```text
local/source-captures/waterproof-case-chatgpt.txt
```

## One Sentence

Commandbook is a permissioned, inspectable shell for human tasks: the user states
intent, the planner builds a safe command pipeline, and every command is
constrained by declared capabilities, trust level, inputs, outputs, tests, and
dry-run behaviour.

## Why This Matters

The unsafe pattern is:

```text
User -> AI -> full device access
```

That gives an assistant too much power and too little structure.

Commandbook creates a boundary:

```text
User -> Commandbook -> Capabilities -> Drivers -> Device
```

The command is not just an action. It is a security policy.

## Core Concepts

### Command

A named intent with a contract.

Example:

```yaml
name: running_late
inputs:
  - contact
  - eta
  - message
outputs:
  - message_id
capabilities:
  - send_message
trust_level: level_1
side_effects:
  - sends_message
dry_run: true
```

The fuller language for this is captured in
[`docs/command-contract.md`](command-contract.md).

Queries and mutations are captured in
[`docs/operation-contract.md`](operation-contract.md).

Drivers are captured in [`docs/driver-contract.md`](driver-contract.md).

Configuration changes are captured in
[`docs/configuration-change-model.md`](configuration-change-model.md).

Local-first implementation direction is captured in
[`docs/local-first-implementation-strategy.md`](local-first-implementation-strategy.md).

The reusable core boundary is captured in
[`docs/reusable-core.md`](reusable-core.md).

CLI discovery and help are captured in
[`docs/cli-discovery-and-help.md`](cli-discovery-and-help.md).

Resumable setup graphs are captured in
[`docs/resumable-setup-graphs.md`](resumable-setup-graphs.md).

The coffee grinder run model is captured in
[`docs/coffee-grinder-run-model.md`](coffee-grinder-run-model.md).

Scheduled runs and interruption are captured in
[`docs/scheduled-runs-and-interrupts.md`](scheduled-runs-and-interrupts.md).

Android wakeup/runtime notes are captured in
[`docs/platform-android-wakeup-notes.md`](platform-android-wakeup-notes.md).

Deno permission-model research is captured in
[`docs/research-deno-permissions.md`](research-deno-permissions.md).

Temporal workflow research is captured in
[`docs/research-temporal-workflows.md`](research-temporal-workflows.md).

The capability gap builder loop is captured in
[`docs/capability-gap-builder-loop.md`](capability-gap-builder-loop.md).

The prior-art sanity check is captured in
[`docs/prior-art-sanity-check.md`](prior-art-sanity-check.md).

The first end-to-end example is
[`docs/examples/android-settings-guided-change.md`](examples/android-settings-guided-change.md).

The water-trip logger example is captured in
[`docs/examples/water-trip-location-logger.md`](examples/water-trip-location-logger.md).

Reusable operation patterns are captured in
[`docs/operation-patterns.md`](operation-patterns.md).

### Trust Levels

Suggested first draft:

```yaml
level_0:
  description: read-only

level_1:
  description: communication

level_2:
  description: create content

level_3:
  description: spend money

level_4:
  description: emergency actions
```

Examples:

```text
check_weather      -> level_0
what_is_next       -> level_0
running_late       -> level_1
check_in           -> level_1
capture_note       -> level_2
order_parawing     -> level_3
call_coastguard    -> level_4
```

### Dry Run

Before side effects, the system can show what would happen.

Example:

```bash
dry_run emergency
```

Output:

```text
Would:
- Send location to Cat
- Send SMS to emergency contact
- Dial Coastguard

Nothing executed.
```

### Pipes

Commands can compose if their outputs match another command's inputs.

Examples:

```bash
current_location | message Cat
eta_home | running_late Cat
capture_note | summarize | email Tom
record_audio | transcribe | classify | save_job
```

This turns the assistant into a human-task shell, not a generic chatbot.

### Planning Graph

The system can be Pathom-like:

```text
known facts + desired goal -> planning graph -> execute steps -> replace
steps with data -> finish or fail inspectably
```

Example goal:

```yaml
want:
  - message_sent
  - location_shared
  - result_logged
```

The command is not a hard-coded script. It is a desired end state.

Terminology note: Pathom calls read-side input-to-output operations resolvers.
Commandbook calls those queries. The thing that finds the route is the planner.

## Product Hypothesis

If a user has 50 commands they genuinely use every week, the commandbook becomes
a valuable personal dataset: a machine-readable description of how a real person
wants technology to help them.

## Implementation Direction

Commandbook should run locally first.

GitHub or another shared registry can distribute recipes, contracts, tests, and
drivers, but command execution should not require a central backend. The coffee
grinder should persist run state through a small local run-store abstraction.

Linux should be the first implementation target because it removes phone
deployment friction and makes the coffee grinder/planner loop easier to test.

## Early Questions For Grilling

1. Is Commandbook a standalone app, or a layer inside JobDone / Workflow Manager?
2. What is the first real command Peter would use this week?
3. Does the first version need voice, or can it start as text/CLI?
4. What Linux command should prove the concept first?
5. What trust level must be implemented first?
6. What does the command schema need to include for a useful dry-run?
7. Is the planning graph needed in V1, or should V1 use explicit pipelines?
8. How does a user inspect, test, and edit commands without becoming a
   programmer?
