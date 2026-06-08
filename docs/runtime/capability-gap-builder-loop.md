# Capability Gap Builder Loop

Commandbook should be able to notice when the graph cannot finish because a
piece is missing or broken.

Sometimes the useful next step is not "tell the human to install something".
Sometimes it is "build the missing query, mutation, driver, verifier, or setup
graph while getting the job done."

Sometimes the piece used to work, but the world changed underneath us: an app
updated, a website moved a button, an API changed, a phone OEM moved a settings
screen, or a permission flow changed.

## Core Idea

```text
Goal
  -> Planner
  -> Capability gap
  -> Capability agent searches for existing fix
  -> Capability agent creates or applies missing piece
  -> Tests and safety review
  -> Install locally at low trust
  -> Resume coffee grinder run
  -> Propose publishing generic version
```

## Open To Closed

Commandbook bootstraps from a fragile open system into a more closed,
deterministic system.

At the start, a clever agent may have to improvise: inspect the environment,
write a driver, ask the human a question, or discover a settings route.

When that improvisation works, the useful part should crystallise into:

- a command contract
- a query or mutation contract
- a driver contract
- tests
- a recovery strategy
- an idempotency strategy
- docs
- a reusable package

The next run should need less improvisation.

## Capability Gap

A capability gap exists when the planner can describe what is missing but cannot
currently satisfy it.

Examples:

- no driver can send email through the chosen provider
- no query can read the current phone model
- no mutation can open the needed Android settings screen
- no setup graph can get an API key installed
- no verifier can prove an effect happened
- a previously working driver no longer works because the world changed

The cleanest gap description is an input/output signature:

```yaml
have:
  facts:
    - youtube.video/id
  capabilities:
    - send_network_request
need:
  facts:
    - youtube.video/transcript
or:
  effects:
    - message_sent
missing:
  provider_path: true
```

This gives the capability agent a bounded job. It is not asked to "make video
work". It is asked to find or build a provider path from known inputs to required
outputs, under the current capability and safety rules.

## Gap Filler

A gap filler is the smallest new piece, or graph of pieces, that can close a
capability gap.

It can be:

- a command contract
- a query contract
- a mutation contract
- a driver contract
- a driver implementation
- a setup graph
- a verifier
- a fake driver
- a test

Gap fillers should be searchable by type signature:

```yaml
requires:
  facts:
    - input fact keys
  capabilities:
    - allowed capability names
provides:
  facts:
    - output fact keys
  effects:
    - effect names
```

This is deliberately similar to searching for functions by type signature. The
registry should answer:

```text
Given what I have, what can produce what I need?
```

Namespaced fact keys make this practical. `youtube.video/id` and
`local.video/path` may both represent videos, but they open different provider
paths.

## Failure Capsule

When a run fails, the coffee grinder should capture a failure capsule.

The failure capsule is the handoff from execution to repair.

It should include:

- command and arguments
- goal
- current facts
- selected plan
- selected driver and version
- operation contract
- driver contract
- checkpoint history
- dry-run approval state
- idempotency strategy
- recover result
- error output
- relevant environment metadata
- redacted logs or screenshots where safe
- synthetic reproduction hints

It must not include:

- raw private messages
- secrets
- credentials
- unredacted personal captures
- private device identifiers unless explicitly allowed

## Capability Agent

A capability agent responds to a capability gap or failure capsule.

First steps:

```text
1. Read the gap signature: available facts, required facts/effects, allowed
   capabilities, selected platform, and safety constraints.
2. Search the shared registry and open PRs for a matching provider path or
   failure signature.
3. If a patch exists, apply it locally at low trust.
4. Run fake-driver and regression tests.
5. Try to complete the original coffee grinder run.
6. If it works, record validation evidence.
7. If no patch exists, create the smallest gap filler.
```

Capability agents are not allowed to silently publish private state. They repair
the generic capability and keep Peter-specific evidence local or redacted.

The capability agent should prefer existing provider paths over new invention.
New code is justified only when the registry cannot satisfy the declared
signature with existing pieces.

## Builder Agent

A builder agent is an agent allowed to create missing Commandbook pieces.

It can create:

- command contracts
- query contracts
- mutation contracts
- driver contracts
- driver implementations
- setup graphs
- fake drivers
- tests
- examples
- docs

Builder agents are one kind of capability agent. Repair agents are another.

## Shared Repair Loop

When many users hit the same broken driver or operation, their capability agents
should converge on a shared fix.

```text
User A hits failure
  -> failure capsule
  -> capability agent creates PR

User B hits same failure
  -> searches open PRs
  -> applies PR patch locally
  -> tests by getting the job done
  -> adds validation result

User C hits same failure
  -> applies same PR patch locally
  -> tests by getting the job done
  -> adds validation result

Maintainer or policy sees repeated validation
  -> merge when threshold is met
```

The threshold might be:

- one maintainer approval
- three independent successful validations
- one successful validation on each affected platform/profile
- stricter review for high-trust mutations

The exact merge rule can vary by risk.

## Safety Rule

Generated functionality starts local and low trust.

Before a new driver or mutation can be trusted, it needs:

- declared capabilities
- dry-run behaviour
- idempotency strategy
- recover behaviour
- tests
- at least one fake-driver test path
- explicit human approval before risky mutation use

## Publish Rule

Do not publish Peter-specific data.

The publishable version should contain:

- generic contracts
- generic driver code
- synthetic fixtures
- redacted examples
- tests
- docs

The local version may contain private setup facts, credentials, route caches, and
device profiles. Those stay local.

## Shared Registry

The shared open-source repo should act as a registry of reusable pieces:

```text
commands/
queries/
mutations/
drivers/
setup-graphs/
tests/
examples/
```

Registry lookup should support both human search and planner search:

- by command name or intent
- by required facts
- by produced facts
- by produced effects
- by capability
- by platform
- by setup requirement
- by failure signature

The coffee grinder can install from the registry, but new or updated pieces
should still be checked against local capability policy before use.

Open PRs are part of the registry workflow. Before building a new fix, capability
agents should check whether a matching PR, patch, issue, or failure signature
already exists.

## Example: Email Provider Missing

Human request:

```text
Send Jane an email about the website.
```

Planner discovers:

```text
No installed email driver.
```

Choice resolver asks:

```text
Which email provider should I set up?
Recommended: Brevo, because we already tested it for Tara.
```

If the Brevo driver does not exist yet:

```text
Builder agent creates brevo_email_driver.
Builder agent writes fake-driver tests.
Coffee grinder pauses for API key.
Human supplies key.
Setup graph verifies test email.
Coffee grinder resumes original send email goal.
```

After it works locally:

```text
Builder agent proposes a generic brevo_email_driver package for the shared repo.
Human approves publication.
```

## Example: Android Settings Route Breaks

Human request:

```text
Make JobDone unrestricted in battery settings.
```

Coffee grinder failure:

```text
Previously cached Samsung route no longer matches the current Settings app.
```

Repair loop:

```text
Coffee grinder captures failure capsule.
Capability agent searches open PRs for Samsung battery route fix.
If patch exists, applies it locally and tests the guided change.
If patch works, records validation.
If no patch exists, capability agent discovers new route and opens PR.
Next users who hit the same failure try the PR first.
After enough validations, the fix merges.
```

## Design Rule

Missing capability is not always a dead end.

Broken capability is not always a local dead end either.

It can become a shared repair task, but building and repairing must still pass
through the same permission, dry-run, recovery, testing, and publication membrane
as ordinary execution.
