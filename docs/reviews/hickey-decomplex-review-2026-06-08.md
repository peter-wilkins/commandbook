# Hickey Decomplex Review: Commandbook Registry And Permissions

Date: 2026-06-08

Scope:

- registry graph model
- implementation bindings
- capability and permission model
- command-composed proof
- gap-agent loop

Review question:

```text
What has been braided together that can vary independently?
```

## Verdict

The current direction is good, but the permission model was starting to tangle
commands with capabilities. That has now been corrected in docs: commands
describe intent, goal, trust level, and constraints; operations declare
capability requirements; runtimes grant or refuse those requirements.

Do not implement more capability code until the next few records are kept
separate:

- `CapabilityRequirement`
- `CapabilityGrant`
- `CapabilityLedger`
- `CapabilityBroker`
- `DriverBinding`
- `SafetyPolicy`
- `ProofClaim`

## What Is Already Separated

### Graph Reachability vs Execution

Good split:

```text
GraphEdge
  facts/effects in and out

ImplementationBinding
  edge -> operation
```

This gives graceful degradation. Several implementation bindings can satisfy one
graph edge without changing the graph.

### Test Proof vs Full CI

Good split:

```text
ProofClaim
  evidence for one commandbook piece

Command-composed test plan
  proof relevant to a selected command path

Full CI
  broader release/nightly/registry health check
```

This avoids treating "all tests in all projects" as the only confidence signal.

### Gap Description vs Feature Request

Good split:

```text
GapSignature
  have facts/effects/capabilities
  need facts/effects

Gap agent
  searches/builds the smallest filler for that exact signature
```

The gap agent should not receive vague feature requests.

## Tangled Area Fixed

### Commands vs Capabilities

Old model:

```text
CommandContract
  rejected command-level capability allow-list
```

Problem:

Commands are recipes for intent and desired outcomes. Capabilities are runtime
permission boundaries. Mixing them would make commands too static and would
force the command author to predict every valid route up front.

Corrected model:

```text
CommandContract
  intent
  arguments
  goal
  trust level
  hard constraints
  optional expected_capabilities documentation

Operation
  capability requirements

Runtime
  active grants and enforcement
```

If the selected path needs extra permission, the coffee grinder inserts a
permission-request path and records the result in a local ledger.

## Still At Risk

### CapabilityRequirement vs CapabilityGrant

Keep separate:

```text
CapabilityRequirement
  operation says what power it needs

CapabilityGrant
  human/runtime says what power is currently allowed
```

Do not put grant state into the operation requirement.

### CapabilityGrant vs HumanApproval

Keep separate:

```text
CapabilityGrant
  permission to use a class of power within a scope

HumanApproval
  approval of this concrete side effect after dry run
```

Example:

```text
grant: send_email through Brevo for Tara website work
approval: send this exact email to Jane now
```

### CapabilityGrant vs Platform Permission

Keep separate:

```text
CapabilityGrant
  Commandbook/user permission

PlatformPermission
  Android/browser/Linux/API permission
```

Example:

```text
grant: read_location for water trip logger
platform permission: Android ACCESS_FINE_LOCATION
```

Both must exist for some operations.

### SafetyPolicy vs CapabilityRequirement

Keep separate:

```text
CapabilityRequirement
  what power is needed

SafetyPolicy
  approval, idempotency, recovery, dry-run, retry rules
```

An operation can need the same capability but have different safety policy
depending on whether it is read-only, idempotent, at-most-once, public, private,
or money-related.

### DriverBinding vs Runtime Sandbox

Keep separate:

```text
DriverBinding
  operation + platform -> driver

RuntimeSandbox
  technical enforcement boundary for untrusted code
```

Deno is useful inspiration and may be a good sandbox on desktop/server. It is
not the universal answer for Android/browser/native runtimes. JavaScript sandbox
options are captured in
[`../research/javascript-sandbox-options.md`](../research/javascript-sandbox-options.md).

## Proposed Next Record Order

1. `CapabilityRequirement`
2. `CapabilityGrant`
3. `CapabilityLedger`
4. `CapabilityBroker`
5. `SafetyPolicy`
6. `DriverBinding`
7. `ProofClaim`

Reason:

Permission enforcement needs the requirement/grant/broker split before we can
honestly run untrusted or semi-trusted operations.

## Review Heuristic

Before adding any record or field, ask:

```text
Can this vary independently from the thing I am about to put it inside?
```

If yes, split it.

Examples:

- operation identity can vary independently from graph reachability
- grant history can vary independently from operation requirement
- dry-run approval can vary independently from reusable permission grant
- driver choice can vary independently from capability requirement
- proof can vary independently from implementation

## Next Slice

Grill and implement `CapabilityRequirement` only.

Do not include:

- active grant state
- user approval
- platform permission
- driver binding
- sandbox policy
- proof handles

Those are separate records.
