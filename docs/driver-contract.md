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
safety_constraints:
  - Must not send unless the approved dry run showed recipient and message_text.
  - Must not send to non-allowlisted numbers in test mode.
  - Must return a clear failure if permission is missing.
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
