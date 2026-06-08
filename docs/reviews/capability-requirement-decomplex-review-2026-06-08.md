# Hickey Decomplex Review: Capability Requirement

Date: 2026-06-08

Scope:

- `CapabilityRequirement`
- operation capability declarations
- runtime grants and enforcement

Review question:

```text
What has been braided together that can vary independently?
```

## Verdict

`CapabilityRequirement` should be a tiny operation-level declaration of needed
power. It must not contain grant state, approval results, driver choice, platform
permission state, UI copy, or proof.

The first implementation should be deliberately small:

```text
CapabilityRequirement
  capability key
  scope fact keys
  purpose
```

Everything else belongs elsewhere.

## Already Simple

- Commands describe intent, goals, and constraints.
- Operations describe concrete query/mutation steps.
- Graph reachability is separate from implementation bindings.
- Runtime grants are now named separately from operation requirements.
- Driver binding can vary independently from graph edge reachability.

## Complected / At Risk

1. Operation `capabilities` wording - it sounds like the operation owns
   permission. Rename the concept to `capability_requirements`.
2. Requirement plus grant - a requirement is what the operation needs; a grant is
   what this runtime and human currently allow. Never put `granted`, `denied`,
   `expires_at`, or `approved_by` on the requirement.
3. Requirement plus driver - a requirement should not name a specific driver.
   Different drivers may satisfy the same operation edge.
4. Requirement plus platform permission - Android, browser, Linux, and API
   permissions are platform facts or driver setup requirements, not the same
   thing as Commandbook capability grants.
5. Requirement plus approval - approving one concrete side effect belongs to
   dry-run / approval records. It is not the same as granting a reusable class of
   power.
6. Requirement plus safety policy - the requirement can describe needed power,
   but policy decides how much friction, confirmation, or sandboxing is required
   before running.
7. Requirement plus proof - tests and proof claims should show that broker,
   grant matching, and driver enforcement work. They should not live inside the
   requirement object.

## Proposed Boundary

### Capability Requirement

Stable data attached to an operation contract.

```text
capability_key
  namespaced power requested by the operation

scope_fact_keys
  facts whose runtime values bound the request

purpose
  short stable explanation for humans and docs
```

`scope_fact_keys` is the important decomplexing move. The requirement points to
facts, not raw values. At runtime, the broker resolves those facts from the
current run context and compares the resulting scoped request with active grants.

Example:

```yaml
capability_requirements:
  - capability_key: location/read_current
    scope_fact_keys:
      - device/current_location
    purpose: Estimate route and arrival time.
  - capability_key: message/send
    scope_fact_keys:
      - contact/recipient
      - message/body
    purpose: Send the approved message.
```

The operation says "I need this class of power, scoped by these facts." It does
not say whether that power is granted.

### Capability Grant

Separate runtime-local state.

```text
capability_key
scope
decision
expiry
ledger reference
```

The grant records what the user/runtime allowed. It can be denied, revoked, or
expired without changing the operation contract.

### Capability Broker

Runtime behaviour.

```text
requirement + current facts + active grants + safety policy -> scoped handles or pause
```

The broker is the enforcement boundary. If it only records nice intentions, the
security model is documentation rather than protection.

## Approved Zod Schema

Peter approved this shape on 2026-06-08. It is implemented in
`src/core/registry.js`.

```js
export const CapabilityKeySchema = NamespacedKeySchema

export const CapabilityRequirementSchema = z.object({
  capabilityKey: CapabilityKeySchema,
  scopeFactKeys: z.array(FactKeySchema).default([]),
  purpose: z.string().min(1).optional()
})
```

Why this is intentionally small:

- no grant state
- no status
- no approval result
- no driver ID
- no platform permission ID
- no safety policy fields
- no UI-specific copy
- no proof/test fields

## First Proof Slice

Test only the shape and the matching boundary:

1. Parse a requirement with a namespaced capability key.
2. Reject non-namespaced capability keys.
3. Preserve scope fact keys as fact references.
4. Keep grant matching out of this schema test.

## Next Slice

Design the next record separately. Likely next candidates are `CapabilityGrant`
or a tiny broker-scoped request shape, but do not add either until the split is
reviewed.
