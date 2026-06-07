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

A command describes what the user means, what information is required, what may
happen, and what must be shown before action is taken.

### Intent

The user's desired outcome, expressed without committing to a specific device,
app, or service.

### Capability

A permissioned class of action that a command may need.

Examples include reading location, sending a message, creating content, spending
money, or starting an emergency action.

### Driver

The thing that can perform a capability in a particular environment.

Drivers are replaceable. The commandbook should outlive any one driver.

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

### Resolver

A way of finding a path from known information to a desired outcome.

Resolvers let the user ask for an outcome without manually naming every step.

### Help

A commandbook interaction where the system explains what is possible, what is
safe, and what information is missing.

### Create Command

A commandbook interaction where the user and system define a new reusable
command from a repeated task or one-off action.

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
