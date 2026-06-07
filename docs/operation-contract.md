# Operation Contract

An operation contract is the durable description of a query or mutation. It is
the shape a planner, runner, test, driver, and UI can inspect.

This is a first-pass product language contract, not a final schema.

## Shared Fields

### Name

The stable operation name.

Example: `estimate_travel_time`

### Kind

Either `query` or `mutation`.

### Requires

Facts that must be available before the operation can run.

### Optional

Facts that may improve the operation but are not required.

### Capabilities

Capabilities the operation needs.

### Driver Requirements

The kind of driver needed to implement this operation in a given environment.

Driver contracts are described in:

```text
docs/driver-contract.md
```

### Failure Cases

Known ways the operation can fail.

### Examples

Concrete examples of inputs, outputs, and failures.

### Constraints

Rules that limit surprising behaviour.

## Query Contract

A query is read-only. It produces facts from known facts.

Query-specific fields:

- `provides`: facts this query can produce
- `freshness`: whether stale facts are acceptable
- `privacy`: whether the query reads private local or remote data

### Example: `estimate_travel_time`

```yaml
name: estimate_travel_time
kind: query
requires:
  - current_location
  - destination
provides:
  - eta
  - route_summary
capabilities:
  - read_location
  - estimate_travel_time
driver_requirements:
  - maps_or_routing_driver
freshness:
  eta: live
failure_cases:
  - current_location_unavailable
  - destination_unknown
  - routing_service_unavailable
constraints:
  - Must not send messages.
  - Must not publish or store location unless another approved operation does so.
examples:
  - input:
      current_location: "Waterloo Station"
      destination: "home"
    output:
      eta: "18:42"
      route_summary: "Train then walk"
```

## Mutation Contract

A mutation may create side effects outside the commandbook.

Mutation-specific fields:

- `effects`: effects this mutation may create
- `dry_run`: what must be shown before the mutation runs
- `idempotency`: how repeat execution is prevented or made safe
- `approval`: what approval is required

### Example: `send_message`

```yaml
name: send_message
kind: mutation
requires:
  - recipient
  - message_text
effects:
  - message_sent
provides:
  - message_id
  - sent_at
capabilities:
  - send_message
driver_requirements:
  - messaging_driver
dry_run:
  must_show:
    - recipient
    - message_text
    - channel
approval:
  required: true
idempotency:
  key_facts:
    - recipient
    - message_text
    - command_run_id
failure_cases:
  - recipient_unknown
  - messaging_driver_unavailable
  - user_denied_approval
constraints:
  - Must not send to a recipient not shown in the dry run.
  - Must not alter message_text after approval.
examples:
  - input:
      recipient: "Cat"
      message_text: "Running late. ETA 18:42."
    effect:
      message_sent: true
    output:
      message_id: "msg_123"
      sent_at: "2026-06-07T18:10:00+01:00"
```

## Relationship To Commands

A command contract defines the user-facing intent and safety envelope.

Operation contracts define the graph nodes the planner can use inside that
envelope.

```text
Command -> Goal -> Planner -> Query/Mutation Plan -> Dry Run -> Runner
```
