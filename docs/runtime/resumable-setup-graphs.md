# Resumable Setup Graphs

Setup is part of the graph.

Driver setup requirements should not be treated as a flat checklist forever. A
requirement like "API key configured" or "phone permission granted" can itself be
a goal with queries, mutations, approvals, and human requirements.

## Core Idea

```text
Command Goal
  -> Planner
  -> Plan needs driver
  -> Driver setup requirement missing
  -> Setup Graph
  -> Coffee Grinder runs until blocked or complete
  -> Resume original plan
```

The same planning model applies at both levels:

```text
facts + goal -> planner -> plan -> runner -> checkpoint/result
```

## Coffee Grinder

The coffee grinder is the resumable loop around planning and execution.

See [`coffee-grinder-run-model.md`](coffee-grinder-run-model.md) for the fuller
run model.

It owns:

- the current goal
- the selected plan
- known facts
- completed queries
- completed mutations
- dry-run approvals
- failed paths
- human requirements
- checkpoints

It keeps going until one of these happens:

- the goal is complete
- every safe path fails
- a human requirement is reached
- the user cancels the run

## Human Requirements

A human requirement is something the system cannot safely do alone.

Examples:

- get an API key
- pay for an account
- approve an Android permission dialog
- plug in a phone
- unlock a browser session
- choose between two risky options

When the graph hits a human requirement, the run should pause with a clear
request. When the human supplies the missing thing, the run resumes from the last
checkpoint.

## Installed Drivers As Cached Setup State

An installed driver is not literally a cached mutation.

Better language:

```text
installed driver = cached setup state
```

That cached setup state may include:

- facts from setup queries
- effects from setup mutations
- approvals
- credentials
- permissions
- driver health checks
- timestamps and expiry

This distinction matters because the mutation is the operation definition. The
installed driver is the remembered result of successfully running the setup
graph.

## Example: Email API Driver

```yaml
driver: email_api_driver
setup_requirements:
  - api_key_configured
  - sender_domain_verified
  - test_email_sent
setup_graph:
  goal:
    facts:
      - api_key_configured
      - sender_domain_verified
      - test_email_sent
  queries:
    - check_env_for_api_key
    - check_domain_verification
  mutations:
    - save_api_key
    - send_test_email
  human_requirements:
    - create_api_key_in_provider_dashboard
    - paste_api_key
    - click_domain_verification_link
checkpoints:
  - after_api_key_saved
  - after_domain_verified
  - after_test_email_sent
```

If `api_key_configured` is missing, the coffee grinder pauses and asks the human
for the key. Once the key is supplied, the same setup graph resumes. It does not
start over from scratch unless the prior checkpoint is invalid.

## Design Rule

Do not special-case setup as "before the real work".

Setup is real work. It can have side effects, cost money, touch private data, and
need human approval. Therefore setup belongs inside the same planning,
checkpointing, dry-run, and permission model as ordinary commands.
