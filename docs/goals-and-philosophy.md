# Goals And Philosophy

## North Star

Commandbook makes AI-assisted action safe and inspectable by turning repeated
human tasks into permissioned commands.

The user should be able to say what they want. The system should be able to
explain what it can do, what it cannot do, what it needs, and what would happen
before anything risky happens.

## Goals

1. Let users express intent without granting broad device access.
2. Make actions inspectable before execution, especially when side effects are
   involved.
3. Separate stable human intent from replaceable device and service drivers.
4. Make useful commands easy to discover, explain, test, and reuse.
5. Let agents help create new commands without silently expanding their powers.
6. Build a personal automation language that can grow from simple commands into
   composable pipelines.
7. Keep private source material local unless the user explicitly chooses to
   publish or share it.

## Non-Goals

1. Commandbook is not trying to be another unconstrained general assistant.
2. Commandbook is not trying to root phones, bypass app sandboxes, or break
   platform security.
3. Commandbook is not trying to automate every possible task before a few real
   commands prove value.
4. Commandbook is not trying to hide complexity behind opaque magic.
5. Commandbook is not trying to invent a large schema before there is pressure
   from real use.

## Philosophy

### Commands Are Contracts

A command should say what it means, what it needs, what it may do, and what it
returns. This makes the command understandable to humans and usable by agents.

### Capability Before Agency

An agent should not get broad power because it sounds helpful. It gets access to
specific capabilities through specific commands.

### Dry Run Before Risk

When a command has meaningful side effects, the user should be able to see what
would happen first.

### Helpful Friction

The system should be fast for low-risk commands and slower for higher-risk
commands. Friction is not a failure when it protects the user from expensive,
embarrassing, or dangerous action.

### Drivers Are Replaceable

The user's command language should not be locked to one phone app, automation
tool, browser, AI provider, or operating system.

### Planning Is Separate From Operating

A query knows how to produce facts. A mutation knows how to create side effects.
The planner decides which queries and mutations can satisfy a goal.

Do not call the planner a resolver.

### Domain Language Matters

The words in the commandbook become the product. If the language is sloppy, the
automation will be sloppy.

### Complexity Requires Proof

Planners, indexes, schemas, trust models, and pipelines are useful only when they
make a real command safer, clearer, or faster. Add them in response to observed
need.

## Early Shape

The first useful product is probably not a big app. It is a small commandbook
with a few real commands, clear dry runs, and one or two drivers.

`help` and `create command` are important because they make the system teachable.
They should come after the goals and language are stable enough that the system
knows what it is explaining or creating.

## Open Product Questions

1. Is Commandbook mainly a standalone product, a layer inside Workflow Manager,
   or a pattern that can live inside many products?
2. What is the first command that proves the philosophy under real pressure?
3. What is the smallest trust model that is useful without becoming theatre?
4. How does a non-technical user edit or approve a command safely?
5. What does `help` need to know before it becomes genuinely useful?
6. What does `create command` need to ask before it can safely create a new
   command?
