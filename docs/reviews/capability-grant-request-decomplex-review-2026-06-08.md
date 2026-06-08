# Hickey Decomplex Review: Capability Grant And Scoped Request

Date: 2026-06-08

Scope:

- `ScopedCapabilityRequest`
- `CapabilityGrant`
- capability ledger boundary
- broker matching boundary

Review question:

```text
What has been braided together that can vary independently?
```

## Verdict

Do not jump straight from `CapabilityRequirement` to `CapabilityGrant`.

There is a missing runtime value between them:

```text
CapabilityRequirement + current facts -> ScopedCapabilityRequest
```

The scoped request is an ephemeral runtime ask. The grant is persistent active
permission. The broker compares them.

Keep these separate:

- `CapabilityRequirement`: static operation contract.
- `ScopedCapabilityRequest`: runtime request after scope facts are resolved.
- `CapabilityGrant`: active permission projection.
- `CapabilityLedgerEvent`: append-only history of grant/deny/revoke/expiry.
- `SafetyPolicy`: friction and proof rules.
- `HumanApproval`: approval for one concrete side effect.

Capability keys are namespaced, but they name the power only. Do not encode
grant or status in the key.

Good:

```text
message/send
location/read_current
network/post
android/open_settings
```

Bad:

```text
message/granted
location/revoked
network/post_approved
android/open_settings_pending
```

Grant and status information belongs in `CapabilityGrant` and
`CapabilityLedgerEvent` records that reference the capability key.

## Already Simple

- Operation requirements no longer carry grant state.
- Requirements point to scope fact keys rather than raw runtime values.
- Driver selection is separate from graph reachability.
- The broker is named as the enforcement boundary.

## Complected / At Risk

1. Requirement plus request - a requirement has fact-key references; a scoped
   request has resolved scope bindings for this run.
2. Request plus grant - a request asks; a grant allows. Do not put `decision` or
   expiry on the request.
3. Grant plus ledger - a grant is active permission; denials and revocations are
   historical events that project into active grants.
4. Grant plus approval - a grant may allow "send message to Jane through Tara";
   a human approval still authorises the exact message body after dry run.
5. Grant plus safety policy - policy decides when broad grants are acceptable,
   when to ask again, and when sandboxing is required.
6. Scope plus private payload - scope should bind permission with facts that are
   safe and relevant to permission. Do not make reusable grants depend on exact
   message bodies or request payloads unless that is intentionally the product.

## Boundary

### Scoped Capability Request

Runtime-only value produced by the broker preflight.

```text
capability_key
scope_bindings
purpose
```

It answers:

```text
What exact scoped power is this operation asking for right now?
```

It does not answer:

```text
Is this allowed?
Which driver will run?
Has the user approved the side effect?
What audit event should be written?
```

### Capability Grant

Active local permission.

```text
grant_id
capability_key
scope_bindings
expires_at
```

It answers:

```text
What scoped powers are currently allowed on this runtime?
```

It does not answer:

```text
Who clicked approve?
Was there a previous denial?
Which dry run was approved?
Which driver is safest?
```

Those belong to ledger events, approvals, policies, and bindings.

### Scope Binding

A scope binding should be matchable without storing raw private values by
default.

First pass: exact-value digest matching only.

```text
fact_key
value_digest
```

Example:

```yaml
capability_key: message/send
scope_bindings:
  - fact_key: contact/recipient
    value_digest: sha256:...
  - fact_key: message/channel
    value_digest: sha256:...
```

The broker can hash the current run's canonical fact values and compare digests.
If a future grant needs patterns such as "any recipient on this domain", that is
a different grant-scope policy record, not a reason to overload this first
record.

Storage paths may use capability key parts for convenience, but storage layout is
not the semantic key. For example, `capability-grants/message/send/...` can store
active `message/send` grants; the capability remains `message/send`, not
`message/send/granted`.

## Zod Schemas

Implemented in `src/core/registry.js` after Peter approved the shape.

```js
export const ScopeValueDigestSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/)

export const CapabilityScopeBindingSchema = z.object({
  factKey: FactKeySchema,
  valueDigest: ScopeValueDigestSchema
})

export const ScopedCapabilityRequestSchema = z.object({
  capabilityKey: CapabilityKeySchema,
  scopeBindings: z.array(CapabilityScopeBindingSchema).default([]),
  purpose: z.string().min(1).optional()
})

export const CapabilityGrantSchema = z.object({
  grantId: SnakeCaseIdSchema,
  capabilityKey: CapabilityKeySchema,
  scopeBindings: z.array(CapabilityScopeBindingSchema).default([]),
  expiresAt: z.string().datetime().optional()
})
```

Why this is intentionally limited:

- no `decision` on a request
- no `deny` or `revoke` state on a grant
- no driver ID
- no approval result
- no safety policy fields
- no raw private payload values
- no wildcard or pattern grants yet
- no ledger event schema yet

## Open Questions

1. Is digest-only scope too opaque for human review, or should labels live in a
   separate presentation/audit record?
2. Should broad grants be represented by empty `scopeBindings`, or should broad
   grants require an explicit safety policy before they are legal?
3. Should `grantId` stay `snake_case`, or do generated grant IDs need a separate
   ID shape?

## Next Slice

Do not implement the security stack yet. Keep `CapabilityLedgerEvent` as a
future receipt/audit record, separate from grant/request records, so active
permission projection and historical events remain independently changeable.

For now, Commandbook can run trusted local recipes in YOLO mode. The next
security slice should wait until there is a real enforcement boundary to test:
broker, sandbox, permission store, or a concrete side effect that must be
blocked without approval.
