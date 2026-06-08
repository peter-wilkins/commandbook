# Pathom Language Notes

These notes capture what Commandbook borrows from Pathom and where the language
should intentionally differ.

Sources:

- https://pathom3.wsscode.com/docs/
- https://pathom3.wsscode.com/docs/resolvers/
- https://pathom3.wsscode.com/docs/planner/
- https://pathom3.wsscode.com/docs/indexes/
- https://pathom3.wsscode.com/docs/nouns/
- https://pathom3.wsscode.com/docs/mutations/
- https://pathom3.wsscode.com/docs/integrations/graphql/
- https://pathom3.wsscode.com/media/

## Useful Pathom Concepts

### Resolver

In Pathom, a resolver is a building block that declares relationships between
attributes. It usually has input requirements and always provides at least one
attribute.

Commandbook equivalent: `Query`.

Avoid using resolver to mean the thing that finds a route.

### Attribute

In Pathom, attributes are named pieces of data. Resolver inputs and outputs are
attributes.

Commandbook equivalent: `Fact`.

In Commandbook, zero or more facts make the current planning context. A fact is
not necessarily known yet; it may be a named placeholder that can become known if
a query can compute or sense it from other facts.

Command arguments are one source of initial facts. They follow the CLI model:
named inputs, required or optional, with optional defaults.

### Namespaced Attribute

Pathom leans heavily on namespaced keys, such as `:acme.product/id` or
`:acme.product/price`.

Commandbook equivalent: `Fact Key` plus `Fact Namespace`.

This matters once the commandbook can wire in many resources. A generic request
like "find me a video" should not collapse every provider into the same
unqualified `video/id`. You want facts that can retain provenance and resource
shape:

```text
youtube.video/id
youtube.video/title
youtube.channel/id
vimeo.video/id
local.video/path
```

The namespace is not just naming hygiene. It is a planning clue. If the context
contains `youtube.video/id`, the reachability index can discover YouTube-specific
facts and operations without pretending they apply to every video source.

### Planner

In Pathom, the planner decides which resolvers to call and in what order to
satisfy a request.

Commandbook equivalent: `Planner`.

This is the term we should use for route-finding.

### Plan

In Pathom, the plan is a DAG that can contain resolver, AND, and OR nodes.

Commandbook equivalent: `Plan` or `Planning Graph`.

This maps well to inspectable automation because a user can see alternative
routes, parallel safe reads, and required side effects.

### Runner

In Pathom, the runner executes a plan.

Commandbook equivalent: `Runner`.

The Commandbook runner needs stronger safety language because mutations may
affect the user's real life.

### Index

Pathom indexes describe what is reachable from what. The important mental model
is output -> input -> resolver.

Commandbook equivalent: `Reachability Index`.

This index answers questions like:

- What facts can be produced from the facts I already have?
- What mutations can be run from the facts and permissions I already have?
- What is missing before a command can run?

Pathom also exposes indexes in the other direction: given a set of inputs, what
outputs are directly reachable? That shape is useful for Commandbook registry
search, autocomplete, and gap-agent work.

Commandbook should be able to ask:

```text
I have these facts and capabilities.
What commands, queries, mutations, setup graphs, or drivers become available?
```

And:

```text
I need this fact or effect.
What providers can produce it, and what inputs are missing?
```

### Mutation

In Pathom, mutations are the write side and usually perform side effects.

Commandbook equivalent: `Mutation`.

This term is deliberately technical. We will educate users if needed, because the
query/mutation split is central to the safety model.

### EQL Request

In Pathom, EQL describes the shape of data the caller wants.

Commandbook equivalent: `Goal`.

The human says an intent. The system turns that into a machine-readable goal.

### Rootless Entry

GraphQL commonly enters through root `Query` or `Mutation` fields. Pathom's
interesting move is that the graph is primarily about reachable attributes. When
integrating GraphQL, Pathom imports the GraphQL query type specially so its
properties become accessible from anywhere, but Pathom itself does not force
Commandbook-style work to start from one central root object.

Commandbook should borrow the rootless idea:

```text
known facts + desired facts/effects -> plan
```

The starting point is not a hard-coded API root. The starting point is the
current context: command arguments, ambient facts, cached setup state, receipts,
and allowed capabilities.

## Proposed Commandbook Vocabulary

| Pathom term | Commandbook term | Why |
| --- | --- | --- |
| Attribute | Fact | More human, works beyond data APIs |
| Namespaced attribute | Namespaced fact key | Avoids collisions and keeps provider provenance |
| Resolver | Query | Aligns with GraphQL-style read-side operation |
| Mutation | Mutation | Aligns with GraphQL-style write-side operation |
| Planner | Planner | Same meaning, good fit |
| Plan | Plan | Same meaning, inspectable route |
| Runner | Runner | Same meaning |
| Index | Reachability Index | Says what it is for |
| EQL Request | Goal | Product-friendly target language |

## Design Consequence

The Commandbook flow should be described as:

```text
Intent -> Goal -> Planner -> Plan -> Dry Run -> Approval -> Runner -> Result
```

The planner consults:

```text
Facts + Queries + Mutations + Capabilities + Trust Levels + Drivers + Registry
```

This keeps the terms tight:

- Queries produce facts.
- Mutations create side effects.
- The planner finds the route.
- The runner executes the approved route.

## Why Pathom Is A Better Fit Than Plain GraphQL

GraphQL is excellent when a service owner can define a stable schema and clients
enter through explicit query and mutation roots.

Commandbook's harder problem is different:

- facts arrive from many places
- drivers and setup state vary by platform
- missing pieces may be built later
- goals may start from any known fact, not one API root
- the registry needs reverse lookup by required and produced facts

Pathom's input/output attribute model fits this better. A provider can say:

```yaml
requires:
  - youtube.video/id
provides:
  - youtube.video/title
  - youtube.video/transcript
```

Another provider can say:

```yaml
requires:
  - youtube.video/transcript
provides:
  - generic.summary/text
```

The planner can then compose the route without either provider knowing about the
whole product workflow.

The current schema diagrams for this model live in
[`registry-schema-diagrams.md`](registry-schema-diagrams.md).

This is also why capability gaps can be precise. A gap is not "build video
support". It is:

```text
Need: generic.summary/text
Have: youtube.video/id
Missing: provider path from youtube.video/id to youtube.video/transcript,
or from youtube.video/transcript to generic.summary/text
```

## Implementation Stance

Borrow Pathom's ideas before borrowing Pathom itself.

Pathom is a strong reference model for fact-oriented planning, but shipping
ClojureScript and Pathom in the first local-first runtime would add weight and
tooling risk. The first implementation should be a small JavaScript subset with
Commandbook's safety model built in.

Useful Pathom-inspired compatibility work:

- keep small planning fixtures based on Pathom examples
- compare expected reachable facts and route choices
- optionally run Pathom locally as a golden-master oracle during development
- avoid making Pathom a browser, phone, or CLI runtime dependency in V1
