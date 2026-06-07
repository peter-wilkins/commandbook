# Agent Instructions

This repo is the Commandbook product lane.

## Product Boundary

Commandbook explores a permissioned command language for human tasks, especially
phone and everyday life automation.

Do not turn it into a generic chatbot. The key artifact is the commandbook:
machine-readable commands with capabilities, trust levels, dry runs, tests,
inputs, outputs, and side effects.

## Privacy

Raw ChatGPT captures and personal source material belong in ignored `local/`.
Commit only distilled product notes, docs, examples, schemas, tests, and
synthetic fixtures.

## Design Bias

- Commands declare intent; the planner discovers the route.
- Avoid using `resolver` to mean path-finder. In Pathom language, a resolver is
  closer to a Commandbook fact provider.
- The commandbook is documentation, permissions, tests, UI, training data, and
  portability layer.
- Prefer inspectable pipelines over opaque agent action.
- Prefer dry-run and explainability before side effects.
- Complexity needs proof.
