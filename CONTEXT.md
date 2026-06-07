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

### Operation

A query or mutation that can appear in a plan.

Operations are graph nodes the planner can compose.

### Operation Contract

The durable description of a query or mutation.

An operation contract includes the operation name, operation kind, required
facts, optional facts, facts produced or effects created, capabilities, driver
requirements, failure cases, examples, and constraints.

### Query

A read-only operation that can produce one or more facts from known facts.

A Pathom resolver is closest to a Commandbook query.

### Mutation

A side-effecting operation that may change the world outside the commandbook.

Mutations require more care than queries because they may send, publish, spend,
call, delete, or change something.

### Capability

A permissioned class of action that a command may need.

Examples include reading location, sending a message, creating content, spending
money, or starting an emergency action.

### Driver

The thing that can perform a capability in a particular environment.

Drivers are replaceable. The commandbook should outlive any one driver.

### Driver Contract

The durable description of a driver.

A driver contract includes the driver name, platform, supported operations or
capabilities, setup requirements, required permissions, limits, failure cases,
test strategy, and safety constraints.

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

### Checkpoint

A saved point in a plan run.

A checkpoint records enough facts, effects, approvals, failures, and completed
operations for the run to resume without repeating unsafe or expensive work.

### Coffee Grinder

The resumable loop that owns planning and execution.

The coffee grinder plans, runs, checkpoints, pauses for missing human
requirements, resumes when those requirements are satisfied, and stops when the
goal is complete or no safe path remains.

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
