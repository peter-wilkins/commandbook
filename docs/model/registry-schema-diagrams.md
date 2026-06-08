# Registry Schema Diagrams

These diagrams show the first decomplected registry shape.

The goal is to keep separate things separate:

- reachability
- implementation
- capability requirements
- safety policy
- proof

`FactKey`, `EffectKey`, `OperationId`, `GraphEdge`, `GapSignature`, and
`ImplementationBinding` exist in code today. The other records are the next
things to grill.

## Naming

Fact and effect keys use this shape:

```text
namespace.segments/local_snake_case
```

Examples:

```text
youtube.video/id
youtube.video/transcript_text
email.message/body
jobdone.team/invite_code
android.network/is_available
```

Namespace segments are separated by dots. Local names after the slash use
underscores.

## Current Zod Records

```mermaid
classDiagram
  class FactKey {
    +string value
  }

  class EffectKey {
    +string value
  }

  class OperationId {
    +string value
  }

  class GraphEdge {
    +string edgeId
    +FactKey[] requiresFacts
    +FactKey[] providesFacts
    +EffectKey[] providesEffects
  }

  class ImplementationBinding {
    +string bindingId
    +string edgeId
    +OperationId operationId
  }

  class GapSignature {
    +FactKey[] haveFacts
    +FactKey[] needFacts
    +EffectKey[] needEffects
  }

  GraphEdge --> FactKey : requires
  GraphEdge --> FactKey : provides
  GraphEdge --> EffectKey : provides
  ImplementationBinding --> GraphEdge : binds edge
  ImplementationBinding --> OperationId : executes operation
  GapSignature --> FactKey : have/need
  GapSignature --> EffectKey : need
```

## Registry Lookup

```mermaid
flowchart LR
  Have["Have facts\nyoutube.video/id"] --> Signature["GapSignature"]
  Need["Need fact\nyoutube.video/transcript_text"] --> Signature

  Signature --> Lookup["findGraphEdges"]

  EdgeA["GraphEdge\nyoutube_transcript\nrequires: youtube.video/id\nprovides: youtube.video/transcript_text"]
  EdgeB["GraphEdge\nlocal_video_transcript\nrequires: local.video/path\nprovides: local.video/transcript_text"]

  Lookup --> EdgeA
  Lookup -. no match .-> EdgeB

  EdgeA --> Result["Match\nmissing.facts = []"]
```

The lookup is deliberately about graph reachability only. It does not decide
whether the edge is safe, installed, approved, cheap, or tested.

## Implementation Bindings

One graph edge can have several implementation bindings. That gives graceful
degradation without changing the graph.

```mermaid
flowchart LR
  Edge["GraphEdge\nyoutube_transcript\nrequires: youtube.video/id\nprovides: youtube.video/transcript_text"]

  Api["ImplementationBinding\nyoutube_transcript_api\noperation: youtube.video/fetch_transcript_via_api"]
  Scrape["ImplementationBinding\nyoutube_transcript_scrape\noperation: youtube.video/fetch_transcript_via_page_scrape"]
  Cache["ImplementationBinding\nyoutube_transcript_cache\noperation: youtube.video/read_transcript_cache"]

  Edge --> Api
  Edge --> Scrape
  Edge --> Cache
```

V0 lookup returns the available bindings for an edge. Later planning can prefer
local cache, then official API, then scrape, then human/manual fallback.

## Separated Future Records

The next records should link to graph edges or operation ids instead of being
folded into them.

```mermaid
flowchart TB
  GraphEdge["GraphEdge\nfacts/effects in and out"]
  Implementation["ImplementationBinding\nedge -> operation"]

  Capability["CapabilityRequirement\nwhat permission/effect boundary is needed"]
  Safety["SafetyPolicy\napproval, idempotency, recovery"]
  Proof["ProofClaim\ntests, replays, properties"]
  Driver["DriverBinding\noperation + platform -> driver"]

  GraphEdge --> Implementation
  Implementation --> Driver
  Implementation --> Capability
  Implementation --> Safety
  Implementation --> Proof
```

This avoids the earlier `kind` smell. A graph edge is not a query, mutation,
driver, setup graph, verifier, and test all at once. It is just a reachability
claim. An implementation binding is also narrow: it only links the edge to an
operation.

Other records can describe how that claim is implemented, what it is allowed to
do, how it recovers, and what evidence supports it.

## Command-Composed Proof

```mermaid
flowchart LR
  Command["Command\nuser intent + goal"] --> Plan["Selected plan"]
  Plan --> Edge1["GraphEdge A"]
  Plan --> Edge2["GraphEdge B"]
  Plan --> Driver["Driver binding"]
  Plan --> Safety["Safety policy"]

  Edge1 --> Proof1["ProofClaim"]
  Edge2 --> Proof2["ProofClaim"]
  Driver --> Proof3["Fake/live driver tests"]
  Safety --> Proof4["Recovery/idempotency tests"]

  Proof1 --> TestPlan["Composed test plan"]
  Proof2 --> TestPlan
  Proof3 --> TestPlan
  Proof4 --> TestPlan

  TestPlan --> Report["Probably works report\nchecked / not checked"]
```

This is the intended alternative to "always run the entire project test suite".
The agent runs the proof relevant to the command path it just changed.

## Gap Agent

```mermaid
flowchart TD
  Goal["Goal needs fact/effect"] --> Planner["Planner"]
  Planner --> Gap["GapSignature\nhave + need"]
  Gap --> Registry["Registry search"]
  Registry --> Existing{"Existing edge/path?"}
  Existing -- yes --> Apply["Apply low-trust candidate"]
  Existing -- no --> Build["Gap agent builds smallest filler"]
  Apply --> Proof["Run relevant proof"]
  Build --> Proof
  Proof --> Resume["Resume original coffee grinder"]
  Resume --> Publish{"Generic and safe?"}
  Publish -- yes --> PR["Propose shared registry PR"]
  Publish -- no --> Local["Keep local only"]
```

The gap agent should receive the exact available context and required output. It
should not receive a vague feature request.
