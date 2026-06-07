# Capability Gap Builder Loop

Commandbook should be able to notice when the graph cannot finish because a
piece is missing.

Sometimes the useful next step is not "tell the human to install something".
Sometimes it is "build the missing query, mutation, driver, verifier, or setup
graph while getting the job done."

## Core Idea

```text
Goal
  -> Planner
  -> Capability gap
  -> Builder agent creates missing piece
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

The coffee grinder can install from the registry, but new or updated pieces
should still be checked against local capability policy before use.

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

## Design Rule

Missing capability is not always a dead end.

It can become a build task, but building must still pass through the same
permission, dry-run, recovery, testing, and publication membrane as ordinary
execution.
