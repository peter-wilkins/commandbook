# Command Contract

A command contract is the durable description of a command. It is the shape a
human, agent, planner, test, and UI can all inspect.

This is a first-pass product language contract, not a final schema.

## Fields

### Name

The stable command name.

Example: `running_late`

### Intent

The human meaning of the command.

Example: "Tell someone I am running late, using my current situation where
possible."

### Arguments

Named CLI-style inputs supplied when the command starts.

Arguments can be required or optional, and can have defaults.

### Goal

The machine-readable facts or effects the command wants to end up with.

### Allowed Capabilities

The capabilities the command is allowed to use while planning and running.

### Trust Level

The risk category for the command.

The trust level should be high enough for the riskiest mutation the command may
perform.

### Dry-Run Shape

What the user must be shown before risky mutations run.

### Outputs

Facts produced by a successful command.

### Examples

Concrete invocations, including expected dry runs and expected results.

### Constraints

Rules that limit surprising behaviour.

Examples:

- Never message a contact unless the dry run names that contact.
- Never spend money.
- Never call emergency services unless explicitly approved.

## Example: `running_late`

```yaml
name: running_late
intent: Tell someone I am running late.
arguments:
  contact:
    required: true
    description: Person or group to notify.
  destination:
    required: false
    default: home
    description: Destination used to estimate arrival time.
  message:
    required: false
    description: Optional extra message from the user.
goal:
  effects:
    - message_sent
  facts:
    - eta
    - message_text
allowed_capabilities:
  - read_location
  - read_contacts
  - estimate_travel_time
  - send_message
trust_level: level_1
dry_run:
  must_show:
    - recipient
    - message_text
    - eta
    - channel
outputs:
  - message_id
  - sent_at
constraints:
  - Do not send without showing the dry run.
  - Do not change destination silently.
  - Do not contact anyone except the named contact.
```

The command arguments create the initial context:

```text
contact = Cat
destination = home
```

Queries can add facts:

```text
current_location
eta
message_text
```

Mutations can create effects:

```text
message_sent
```

The queries and mutations used by a command are described by operation contracts:

```text
docs/model/operation-contract.md
```
