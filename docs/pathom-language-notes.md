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

### Mutation

In Pathom, mutations are the write side and usually perform side effects.

Commandbook equivalent: `Mutation`.

This term is deliberately technical. We will educate users if needed, because the
query/mutation split is central to the safety model.

### EQL Request

In Pathom, EQL describes the shape of data the caller wants.

Commandbook equivalent: `Goal`.

The human says an intent. The system turns that into a machine-readable goal.

## Proposed Commandbook Vocabulary

| Pathom term | Commandbook term | Why |
| --- | --- | --- |
| Attribute | Fact | More human, works beyond data APIs |
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
Facts + Queries + Mutations + Capabilities + Trust Levels + Drivers
```

This keeps the terms tight:

- Queries produce facts.
- Mutations create side effects.
- The planner finds the route.
- The runner executes the approved route.
