# Driver Contract

A driver contract is the durable description of a platform-specific
implementation.

Commands and operations should remain portable. Drivers are where that portable
language meets Android, a browser, a shell, a web API, Tasker, a local service,
or another concrete environment.

This is a first-pass product language contract, not a final schema.

## Fields

### Name

The stable driver name.

Example: `android_sms_driver`

### Platform

The environment this driver runs against.

Examples:

- Android
- browser
- shell
- local service
- cloud API
- Tasker

### Implements

The operations or capabilities this driver can implement.

### Setup Requirements

What must exist before the driver can run.

Setup requirements are not only static checklist items. They may be goals that
the coffee grinder can plan and run as a setup graph.

Examples:

- app installed
- API key configured
- Android permission granted
- VPN connected
- browser logged in

### Setup Graph

The queries, mutations, approvals, and human requirements that can satisfy setup
requirements.

### Permissions

The platform permissions or credentials the driver needs.

### Inputs And Outputs

How Commandbook facts map to platform-specific inputs and outputs.

### Limits

Known limits of the driver.

Examples:

- can draft but cannot send
- requires foreground app
- unreliable without network
- cannot confirm final delivery

### Failure Cases

Known ways the driver can fail.

### Test Strategy

How the driver can be tested without causing unsafe side effects.

### Safety Constraints

Rules that limit surprising behaviour.

## Required Interface

Every driver should expose a small required interface to the coffee grinder.

```yaml
interface:
  run:
    description: Execute the requested query or approved mutation.
  recover:
    description: Reconcile a checkpoint with the current outside-world state.
```

Mutation-capable drivers must implement `recover`.

`recover` exists because the process may die after a mutation starts but before
Commandbook records the result. The driver must know how to inspect or repair the
state without blindly repeating side effects.

Suggested recovery results:

```yaml
recover_result:
  status:
    one_of:
      - not_started
      - succeeded
      - failed
      - resumable
      - needs_human
      - unsafe_unknown
  facts: []
  effects: []
  next_step: ""
```

Rules:

- If the mutation definitely succeeded, return `succeeded` and the effects.
- If the mutation definitely failed before side effects, return `failed` or
  `not_started`.
- If the mutation can safely continue, return `resumable`.
- If the driver cannot know safely, return `needs_human` or `unsafe_unknown`.
- Use the mutation's idempotency strategy and recovery clues.
- Never repeat an `at_most_once` mutation during recovery unless the driver can
  prove it did not happen.
- Never repeat an `unknown` mutation during recovery.

## Example: `android_sms_driver`

```yaml
name: android_sms_driver
platform: Android
implements:
  operations:
    - send_message
  capabilities:
    - send_message
setup_requirements:
  - phone_connected_or_app_installed
  - sms_permission_granted
setup_graph:
  goal:
    facts:
      - phone_app_installed
      - sms_permission_granted
  mutations:
    - install_phone_app
    - request_sms_permission
  human_requirements:
    - unlock_phone
    - approve_android_permission_dialog
permissions:
  - android.permission.SEND_SMS
inputs_and_outputs:
  recipient:
    maps_to: phone_number
  message_text:
    maps_to: sms_body
  message_id:
    maps_from: platform_message_id
limits:
  - Cannot guarantee recipient read the message.
  - May fail if SMS permission is revoked.
  - May need a foreground confirmation flow on some Android versions.
failure_cases:
  - sms_permission_missing
  - recipient_has_no_phone_number
  - device_offline
  - send_failed
test_strategy:
  - dry_run_only_for_default_tests
  - fake_driver_for_unit_tests
  - allowlisted_test_number_for_integration_tests
interface:
  run:
    inputs:
      - recipient
      - message_text
      - command_run_id
  recover:
    strategy:
      - check_outbox_or_sent_message_receipt
      - compare recipient, message_text, and command_run_id
      - return unsafe_unknown if platform state cannot prove the outcome
idempotency:
  strategy: at_most_once
  recovery_clues:
    - command_run_id
    - recipient
    - message_text
safety_constraints:
  - Must not send unless the approved dry run showed recipient and message_text.
  - Must not send to non-allowlisted numbers in test mode.
  - Must return a clear failure if permission is missing.
  - Must not send a second message during recovery unless idempotency proof is available.
```

## Relationship To Operations

An operation says what can be done in portable Commandbook language.

A driver says how that operation is done in one environment.

```text
Operation Contract -> Driver Requirements -> Driver Contract -> Platform
```

One operation may have many drivers:

```text
send_message
  -> android_sms_driver
  -> whatsapp_driver
  -> signal_driver
  -> email_driver
```

The planner should reason in terms of operations and capabilities. The runner
uses the selected driver when executing an approved plan.

## Resumable Setup

An installed driver is cached setup state, not a special permanent object.

If setup needs a human, money, credentials, a permission dialog, or physical
access to a device, the coffee grinder should checkpoint the setup graph and
pause. Once the missing requirement is supplied, the run should resume without
repeating completed unsafe work.

Examples:

- wait for the user to paste an API key
- wait for the user to approve an Android permission prompt
- wait for payment before enabling a paid API driver
- wait for the phone to be plugged in
