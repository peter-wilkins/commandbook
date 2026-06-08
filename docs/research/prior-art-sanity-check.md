# Prior Art Sanity Check

This is a quick scan, not a complete market map.

Question:

```text
Has someone already built Commandbook?
```

Short answer:

```text
Not as one obvious product.
```

Many adjacent systems exist. Commandbook's likely distinct shape is the
combination of:

- user-owned command contracts
- facts, queries, mutations, drivers
- explicit capabilities and dry runs
- resumable coffee grinder execution
- driver recovery after process death
- setup graphs and choice resolvers
- builder-agent loop that crystallises missing pieces into reusable packages
- shared repair loop where agents reuse and validate fixes when the world
  changes

## Closest Prior Art Families

### Phone Automation

Examples:

- Tasker
- MacroDroid
- Automate
- Apple Shortcuts
- Doneva

What they already prove:

- users want personal device automation
- phone settings and permissions are messy
- actions need triggers, inputs, state, and platform-specific adapters
- AI-generated automations are becoming normal

What Commandbook should borrow:

- practical Android intent/action knowledge
- local device execution
- shortcut/action catalogues
- user-editable workflows

What seems different:

- Commandbook is not primarily a visual macro builder
- the central artifact is a commandbook with contracts and safety semantics
- missing capability can become a builder-agent task
- recovery and idempotency are first-class

Sources:

- https://www.macrodroid.com/download
- https://support.apple.com/guide/iphone/iph47e1c9d7d/ios
- https://doneva.app/

## Workflow Automation

Examples:

- n8n
- Node-RED
- Home Assistant automations
- Microsoft Power Automate

What they already prove:

- graph/node workflows are familiar
- integrations and credentials are the hard bit
- trigger/condition/action models are useful
- workflow libraries become valuable shared infrastructure

What Commandbook should borrow:

- node/operation catalogue thinking
- visible flow state
- credentials/setup UX
- testing and templates

What seems different:

- Commandbook is command-first, not trigger-first
- Commandbook is intended to preserve human context during interactive tasks
- the coffee grinder has a stronger personal safety/recovery model
- drivers are explicitly portable implementations of query/mutation contracts

Sources:

- https://docs.n8n.io/
- https://nodered.org/docs/
- https://www.home-assistant.io/docs/automation/basics/

## Durable Workflow Engines

Examples:

- Temporal
- LangGraph

What they already prove:

- durable execution matters
- checkpointing enables resume after failure
- human-in-the-loop needs persistent state
- replay/recovery semantics need careful design

What Commandbook should borrow:

- event/checkpoint history
- activity/driver separation
- wait/timer/retry patterns
- human interrupt/resume

What seems different:

- Temporal is backend workflow infrastructure
- LangGraph is agent graph infrastructure
- Commandbook is product/domain language for personal permissioned automation
- user approval, mutation recovery, and setup graphs are part of the product
  language, not only infrastructure details

Sources:

- https://docs.temporal.io/
- https://docs.temporal.io/workflows
- https://docs.temporal.io/activities
- https://langchain-5e9cc07a.mintlify.app/oss/python/langgraph/persistence

## Agent Runtimes, Skills, And Tool Registries

Examples:

- OpenClaw
- OpenAI Agents SDK
- MCP
- Dagger AI agents
- agent/skill registries such as Bloom, ToolShed, OpenSkill, AgentSpec

What they already prove:

- tool registries are emerging
- skills/plugins need permissions and setup requirements
- agent traces and guardrails are becoming standard
- local agent gateways are powerful but risky

What Commandbook should borrow:

- skill registry mechanics
- per-tool permissioning
- setup/requirements metadata
- tracing and guardrails
- local-first control

What seems different:

- Commandbook does not start with "let the agent call tools"
- Commandbook starts with a user-owned contract for intent, facts,
  capabilities, dry runs, and recoverable mutations
- builder agents can create missing pieces, but generated pieces enter low-trust
  first
- capability agents can search for existing community fixes before creating new
  ones

Sources:

- https://openclawdoc.com/
- https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md
- https://platform.openai.com/docs/guides/agents-sdk/
- https://openai.github.io/openai-agents-python/guardrails/
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- https://modelcontextprotocol.io/docs/tutorials/security/authorization
- https://docs.dagger.io/0.16.3/ai-agents/
- https://www.usebloom.org/
- https://toolshed.sh/

## Permission Models

Examples:

- Deno permissions
- MCP authorization
- ScopeGate-style permission gateways
- OpenClaw tool policies

What they already prove:

- broad tool access is dangerous
- permissions need to be narrow, inspectable, and enforceable
- OAuth scopes and tool-level permissions are not enough by themselves
- setup and authorization need UX, not only config

What Commandbook should borrow:

- explicit declared capabilities
- permission prompts derived from plans
- separation of runtime permission, platform permission, and user approval

What seems different:

- Commandbook treats permissions as part of command planning, dry runs, and
  resumability
- the permission model is coupled to mutation recovery, not only access control

Sources:

- https://docs.deno.com/runtime/fundamentals/security/
- https://docs.deno.com/api/deno/~/Deno.permissions
- https://scopegate.dev/

## Key Risks From Prior Art

1. Visual workflow tools become powerful but hard to reason about.
2. Agent skill systems can grant broad permissions too easily.
3. Android automation breaks across OEMs, OS versions, app updates, and
   background restrictions.
4. Human-in-the-loop systems can stall unless pause/resume UX is first-class.
5. Registries create supply-chain risk.
6. "AI can build it" can produce a pile of brittle one-off automations unless
   working pieces are crystallised into tests and contracts.
7. Shared repair systems can leak private failure data unless failure capsules
   are aggressively redacted.

## Working Conclusion

Commandbook is not obviously redundant.

The best path is not to compete head-on with Tasker, n8n, Temporal, LangGraph,
OpenClaw, or MCP. The best path is to borrow their proven ideas and focus on the
missing overlap:

```text
personal intent
  + inspectable command contracts
  + permissioned query/mutation graph
  + driver recovery
  + setup graphs
  + builder-agent crystallisation
  + shared agent repair loop
```

## Next Research Questions

1. How much of V1 can be built on top of existing tools such as Tasker,
   MacroDroid, Android intents, or MCP?
2. Is there already an Android-first AI automation app close enough to study or
   use directly, especially Doneva?
3. Can LangGraph provide enough coffee-grinder mechanics for a prototype, or is
   a simpler local checkpoint log enough?
4. What registry format should Commandbook use: its own repo layout, existing
   skills format, MCP, or something compatible with multiple ecosystems?
5. What is the smallest Android settings guided-change prototype that teaches us
   something Tasker/Shortcuts cannot already solve?
