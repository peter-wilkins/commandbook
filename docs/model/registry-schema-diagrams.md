# Registry Schema Diagrams

These diagrams show the first decomplected registry shape.

The goal is to keep separate things separate:

- reachability
- implementation
- capability requirements
- safety policy
- proof

Only `FactKey`, `EffectKey`, `GraphEdge`, and `GapSignature` exist in code today.
The other records are the next things to grill.

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

  class GraphEdge {
    +string edgeId
    +FactKey[] requiresFacts
    +FactKey[] providesFacts
    +EffectKey[] providesEffects
  }

  class GapSignature {
    +FactKey[] haveFacts
    +FactKey[] needFacts
    +EffectKey[] needEffects
  }

  GraphEdge --> FactKey : requires
  GraphEdge --> FactKey : provides
  GraphEdge --> EffectKey : provides
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

## Separated Records

The next records should link to a graph edge instead of being folded into it.

```mermaid
flowchart TB
  GraphEdge["GraphEdge\nfacts/effects in and out"]

  Implementation["ImplementationBinding\nhow to execute this edge"]
  Capability["CapabilityRequirement\nwhat permission/effect boundary is needed"]
  Safety["SafetyPolicy\napproval, idempotency, recovery"]
  Proof["ProofClaim\ntests, replays, properties"]

  GraphEdge --> Implementation
  GraphEdge --> Capability
  GraphEdge --> Safety
  GraphEdge --> Proof
```

This avoids the earlier `kind` smell. A graph edge is not a query, mutation,
driver, setup graph, verifier, and test all at once. It is just a reachability
claim.

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
