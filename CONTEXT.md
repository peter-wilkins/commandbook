# Commandbook Domain Language

This file defines the product language for Commandbook. It should stay free of
implementation details.

## Terms

### Commandbook

The user-owned collection of commands that describe what the user wants agents
and devices to be able to do on their behalf.

The commandbook is the central artifact. It is not just configuration. It is the
boundary between human intent and machine action.

### Command

A named intent with a contract.

A command describes what the user means, what information is required, what facts
or effects are desired, what may happen, and what must be shown before action is
taken.

### Command Contract

The durable description of a command.

A command contract includes the command name, intent, command arguments, goal,
allowed capabilities, trust level, dry-run shape, expected outputs, examples,
and any important constraints.

### Command Argument

A named input supplied when a command starts.

Command arguments follow the familiar CLI model: they can be required or
optional, and they can have defaults. Supplied command arguments become facts in
the initial context.

### Command Recipe

A reusable data description of how a command may be planned or run.

A recipe is shared and inspectable, but each run may differ because the local
device, installed tools, permissions, cached routes, and human choices differ.

### Initial Context

The set of facts available at the start of planning.

The initial context is usually made from command arguments, defaults, ambient
device facts, and user/session facts the command is allowed to use.

### Intent

The user's desired outcome, expressed without committing to a specific device,
app, or service.

### Goal

The facts or effects the user wants to end up with.

An intent is the human expression. A goal is the machine-readable target derived
from that intent.

### Fact

A named piece of information that may be supplied, already known, sensed, or
computed.

Zero or more facts make up the current context for planning. A fact may be
unknown at the start of a command and become known only after a query runs. If a
needed fact cannot be supplied, sensed, or computed, that path through the
planning graph fails.

Examples include current location, contact phone number, ETA, captured note text,
or weather forecast.

### Fact Key

The stable name of a fact.

Fact keys should be specific enough to avoid collisions when many resources,
apps, devices, users, and services are wired into the same commandbook.

### Fact Namespace

The owner or domain prefix of a fact key.

Namespaces let many connected resources describe similar facts without
colliding. They also help the planner and registry understand where a fact came
from and what other facts may be reachable through it.

### Operation

A query or mutation that can appear in a plan.

Operations are graph nodes the planner can compose.

### Operation Contract

The durable description of a query or mutation.

An operation contract includes the operation name, operation kind, required
facts, optional facts, facts produced or effects created, capabilities, driver
requirements, failure cases, examples, and constraints.

### Operation Pattern

A reusable control-flow pattern that helps operations run in the real world.

Examples include wait, poll, watch, verify, timeout, retry, and backoff.

### Query

A read-only operation that can produce one or more facts from known facts.

A Pathom resolver is closest to a Commandbook query.

### Mutation

A side-effecting operation that may change the world outside the commandbook.

Mutations require more care than queries because they may send, publish, spend,
call, delete, or change something.

### Configuration Target

The thing the user wants configured.

Examples include default assistant, default browser, app battery policy,
notification permission, email provider, or project visibility.

### Configuration Scope

Where a configuration change applies.

Examples include current phone, current laptop user account, debug Chrome
profile, a JobDone team, or a Cloudflare account.

### Configuration Subject

The entity being selected, configured, or affected by a configuration target.

Examples include ChatGPT as the assistant, JobDone as the app, Brevo as the
email provider, or Firefox as the browser.

### Desired State

The state the user wants after a command completes.

### Current State

The observed state before or after a query or mutation runs.

### Configuration Surface

The place where a configuration change can be made.

Examples include a settings screen, config file, CLI command, API endpoint, or
web dashboard page.

### Configuration Route

The route to a configuration surface and any remaining steps needed to make the
change.

Configuration routes can become stale when devices, apps, dashboards, or
permissions change.

### Configuration Mode

The level of control the system is allowed to take while pursuing a
configuration change.

Examples include opening only, guiding the human through the change, or directly
applying the change when a driver has enough permission and proof.

### Setting

A platform-specific configuration item.

Use configuration target for the abstract Commandbook concept. Use setting when
talking about a particular platform surface such as Android Settings or a web
dashboard setting.

### Capability

A permissioned class of action that a command may need.

Examples include reading location, sending a message, creating content, spending
money, or starting an emergency action.

### Driver

The thing that can perform a capability in a particular environment.

Drivers are replaceable. The commandbook should outlive any one driver.

### Capability Provider

A driver or package that advertises it can satisfy a capability under stated
conditions.

Capability providers should be discoverable by their required facts, produced
facts or effects, platform support, safety rules, and setup requirements.

### Driver Contract

The durable description of a driver.

A driver contract includes the driver name, platform, supported operations or
capabilities, setup requirements, required permissions, limits, failure cases,
test strategy, and safety constraints.

### Driver Interface

The required functions a driver exposes to the coffee grinder.

At minimum, a driver must support `run` and `recover`. Mutation-capable drivers
must be able to recover after process death without blindly repeating side
effects.

### Recover

A driver function that reconciles a checkpoint with the outside world.

Recover should inspect or repair the current state after interruption and return
whether an operation succeeded, failed, can resume, needs a human, or is unsafe
to continue automatically.

### Setup Requirement

A condition that must be true before a driver or operation can run safely.

A setup requirement may already be satisfied, may be checked by a query, or may
need a setup graph to satisfy it.

### Setup Graph

A plan for satisfying setup requirements.

A setup graph may contain queries, mutations, dry runs, approvals, human
requirements, and checkpoints.

### Installed Driver

A driver whose setup requirements are currently satisfied.

An installed driver is best understood as cached setup state: remembered facts
and effects from completed setup queries and mutations. It is not the mutation
itself.

### Human Requirement

A missing fact, approval, credential, payment, physical action, or decision that
the system cannot safely produce by itself.

When a graph reaches a human requirement, it should pause clearly and resume from
the checkpoint once the human has supplied what is needed.

### Blocking Resolver

A graph node that cannot complete automatically yet.

A blocking resolver pauses the coffee grinder and produces a human requirement,
such as a choice, approval, credential, payment, or physical action.

### Choice Resolver

A blocking resolver that asks the human to choose from a set of options.

The choice resolver should explain the trade-off, record the decision as a fact,
and let the graph resume.

### Checkpoint

A saved point in a plan run.

A checkpoint records enough facts, effects, approvals, failures, and completed
operations for the run to resume without repeating unsafe or expensive work.

### Coffee Grinder

The resumable loop that owns planning and execution.

The coffee grinder plans, runs, checkpoints, pauses for missing human
requirements, resumes when those requirements are satisfied, and stops when the
goal is complete or no safe path remains.

### Run Context

The full serialized state of one command run.

The run context includes facts, goal, queue, stack, completed work,
in-progress work, human requirements, approvals, receipts, and failures.

### Queue Item

A data description of one piece of queued work inside a run context.

Queue items must be serializable data, not function closures, so the run can be
stored, inspected, resumed, and moved between storage adapters.

### Operation Handler

The local implementation for a named queue item.

An operation handler takes a run context and queue item, then returns an updated
run context.

### Receipt

Evidence that a mutation or important step happened.

Receipts help recovery, verification, audit, and human trust.

### Recipe Patch

A proposed change to a command recipe.

Runs may update their own queue immediately, but shared recipes should change
only after the new pattern has evidence or tests.

### Unplanned Issue

A condition discovered during a run that the current command recipe did not
explicitly handle.

An unplanned issue may update the current run queue, create a human requirement,
or produce a recipe patch proposal later. It should not silently mutate the
shared recipe.

### Command Registry

The discoverable index of available command recipes.

The command registry should help users and planners find commands by name,
intent, arguments, facts, effects, capabilities, platform support, and setup
relationships.

### Capability Gap

A missing command, query, mutation, driver, setup graph, verifier, or permission
that prevents the planner from satisfying a goal.

### Gap Filler

A commandbook piece that can close a capability gap.

A gap filler may be one command, a query, a mutation, a driver, a setup graph, a
test, or a small graph of those pieces. It should be described by the facts and
capabilities it requires and the facts or effects it can produce.

### Failure Capsule

A portable, redacted bundle of evidence captured when a run fails.

A failure capsule should include enough context for a capability agent to
reproduce, diagnose, fix, and test the issue without exposing private data.

### Capability Agent

An agent that responds to capability gaps and failures.

Capability agents can search for existing fixes, apply patches, build missing
pieces, repair broken drivers, run tests, and propose pull requests.

### Builder Agent

An agent that can create missing Commandbook pieces when the graph hits a
capability gap.

Builder agents should produce local, tested, low-trust pieces first. Generic
pieces may be proposed for publication only after redaction, tests, and human
approval.

Builder agent is one kind of capability agent.

### Repair Agent

An agent that fixes an existing Commandbook piece when the outside world changes.

Repair agents should start by checking whether another user has already hit and
fixed the same failure.

### Shared Registry

The shared open-source home for generic Commandbook pieces.

The shared registry should contain publishable contracts, drivers, tests,
examples, and docs. It must not contain Peter-specific private facts,
credentials, or raw captures.

### Local Runtime

The device-local Commandbook process that plans and runs commands.

The local runtime should not require a central backend. It may fetch recipes from
a shared registry, but command execution and run state belong locally first.

### Run Store

The durable local store for coffee grinder run state.

A run store can be implemented with localStorage, IndexedDB, SQLite, files, or
Postgres. The important contract is durable key-value access to serialized run
state, not a particular database.

### Storage Adapter

The platform-specific implementation of the run store.

Examples include browser localStorage, browser IndexedDB, native SQLite, JSONL
files, or Postgres.

### Device

A physical or virtual surface where commands may be triggered or executed.

Examples include a phone, laptop, car interface, browser, shell, or assistant
session.

### Trust Level

A risk category for commands and capabilities.

Trust levels exist so that harmless commands can stay quick while dangerous
commands require more proof, friction, or confirmation.

### Side Effect

An observable change outside the commandbook.

Examples include sending a message, publishing a file, spending money, calling a
service, or changing a device state.

### Dry Run

A non-executing preview of what a command would do.

A dry run should be understandable by the user before side effects happen.

### Pipeline

A chain of commands or capabilities where one step's output becomes another
step's input.

### Planner

A component that finds a path from known facts to a goal.

The planner chooses which queries and mutations could satisfy a command, and in
what order.

### Plan

An inspectable proposed route from current facts to a goal.

A plan should show the steps, missing facts, required capabilities, trust levels,
and side effects before risky execution.

### Runner

The component that executes an approved plan.

The runner should follow the plan, report failures clearly, and avoid silent side
effects.

### Reachability Index

A map of what facts and effects can be reached from which known facts,
capabilities, queries, and mutations.

The reachability index helps the planner answer "what can I do from here?"

### Resolver

Avoid using this as the Commandbook term for path-finding.

In Pathom, a resolver is closer to a Commandbook query: it declares the facts it
needs and the facts it can provide. In Commandbook, use planner for path-finding.

### Help

A commandbook interaction where the system explains what is possible, what is
safe, and what information is missing.

### Create Command

A commandbook interaction where the user and system define a new reusable
command from a repeated task or one-off operation.

### Inspection

The act of seeing why the system thinks a command can run, what it will use, and
what it will change.

### Permissioned Automation

Automation where every meaningful action is constrained by declared intent,
capability, trust level, and side-effect rules.

## Language Boundaries

Commandbook is not a generic chatbot. A chatbot may be one interface to a
commandbook, but the commandbook is the durable product.

Commandbook is not blanket device control. Device control may happen only through
declared capabilities and drivers.
