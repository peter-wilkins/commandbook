# Research Note: JavaScript Sandbox Options

This is a research note, not a technology decision.

Sources:

- https://nodejs.org/api/vm.html
- https://nodejs.org/api/permissions.html
- https://github.com/patriksimek/vm2
- https://github.com/laverdet/isolated-vm
- https://docs.endojs.org/modules/ses.html
- https://lavamoat.github.io/about/runtime-environment/
- https://github.com/justjake/quickjs-emscripten
- https://docs.wasmtime.dev/security.html
- https://cljdoc.org/d/org.babashka/sci/0.10.49

## Summary

Do not make Deno the only sandbox story.

Commandbook should support a `RuntimeSandbox` abstraction. Different platforms
can choose different sandbox adapters:

- trusted in-process JS for core and trusted local code
- SES/LavaMoat-style compartments for least-authority JavaScript plugins
- `isolated-vm` for Node/V8 isolate execution
- QuickJS compiled to WebAssembly for a separate JS engine inside JS
- Wasmtime/WASI for non-JS or compiled capsules
- Deno/Node process permissions as seat belts around trusted code, not as the
  whole malicious-code boundary

## Things To Avoid

### `node:vm`

Node's own docs say the `vm` module is not a security mechanism and should not
be used to run untrusted code.

Commandbook may use `node:vm` for trusted evaluation or tests, but not as the
security boundary for registry code.

### `vm2`

`vm2` should be treated as retired for our purposes. Its repository states the
project has critical security issues and is discontinued.

Do not build Commandbook sandboxing on `vm2`.

### Node Permission Model As Sandbox

Node's permission model is useful as a seat belt around a process, but its docs
explicitly frame it as not protecting against malicious code.

Use it to reduce accidental damage in trusted operation capsules. Do not treat it
as a malicious plugin sandbox.

## Candidate Sandboxes

### SES / Endo

SES provides Hardened JavaScript compartments with no ambient authority by
default. Authority is explicitly endowed.

Useful fit:

- JavaScript-native object-capability model
- can run in browser-like and Node-like environments
- maps well to Commandbook's scoped capability handles
- good for plugin/package confinement where APIs are object capabilities

Limits:

- the host is responsible for safe endowments
- CPU and memory denial-of-service still need outer limits
- it is a discipline and runtime hardening model, not a process/container wall

### LavaMoat

LavaMoat builds on SES and adds policy-driven package/global API control.

Useful fit:

- supply-chain protection for JavaScript dependencies
- policy files can document what packages may access
- interesting prior art for Commandbook registry package policies

Limits:

- mostly a package/app hardening story
- still needs host/runtime limits for CPU, memory, filesystem, and subprocesses

### `isolated-vm`

`isolated-vm` exposes V8 isolates to Node.

Useful fit:

- stronger isolation than `node:vm` contexts
- memory limits per isolate
- plausible desktop/server sandbox adapter for JavaScript operation capsules

Limits:

- native dependency and V8/Node ABI sensitivity
- its own README recommends stronger process-style isolation for advanced threat
  models
- not a universal browser/Android answer

### QuickJS via WebAssembly

`quickjs-emscripten` runs the QuickJS engine compiled to WebAssembly.

Useful fit:

- separate JS engine, not host V8 context tricks
- can run inside JavaScript environments
- promising for small untrusted JS snippets

Limits:

- interoperability and async bridging are more constrained
- still needs host-provided capability APIs
- needs outer CPU/memory/time limits and careful resource cleanup

### Wasmtime / WASI

Wasmtime is a WebAssembly/WASI runtime with a sandbox and capability-based
filesystem access.

Useful fit:

- strong candidate for compiled operation capsules
- clean capability story for files/directories and WASI APIs
- can host languages beyond JavaScript

Limits:

- not JavaScript source directly; needs compilation or a JS engine inside Wasm
- adds tooling and packaging complexity
- platform availability and mobile embedding need separate investigation

### SCI / Scittle

The Clojure world's Small Clojure Interpreter is relevant inspiration. SCI
programs do not access Clojure vars unless explicitly provided, and it has
ClojureScript/browser-facing forms such as Scittle.

Useful fit:

- strong example of a small language runtime with explicit provided authority
- good inspiration for data-first command DSLs

Limits:

- it would pull Commandbook toward Clojure-shaped DSLs
- it is probably not the first JavaScript operation sandbox for Commandbook

## Commandbook Design Direction

Add a `RuntimeSandbox` concept, but do not pick one implementation yet.

```text
OperationRequirement
  says what capabilities the operation needs

CapabilityGrant
  says what this runtime/user currently allows

CapabilityBroker
  checks requirement <= grant and issues scoped handles

RuntimeSandbox
  runs untrusted/semi-trusted implementation code with only those handles
```

The sandbox should receive scoped handles, not raw ambient APIs.

Bad:

```text
sandbox gets process, fs, fetch, env
```

Good:

```text
sandbox gets readFile(handle), postJson(handle), emitReceipt(handle)
```

## Recommended First Slice

Do not implement sandboxing yet.

Implement the record split first:

1. `CapabilityRequirement`
2. `CapabilityGrant`
3. `CapabilityLedger`
4. `CapabilityBroker`
5. `RuntimeSandbox` interface

Then test with a no-op trusted sandbox adapter before choosing SES,
`isolated-vm`, QuickJS, Deno, or Wasmtime.

## Current Recommendation

For Commandbook V0:

- trusted local operations run in-process
- untrusted/shared registry code is not executable by default
- sandbox choice is recorded as a runtime adapter decision
- do not rely on `node:vm`, `vm2`, or Node permissions as the malicious-code
  boundary

For likely V1 desktop/server experiments:

- try SES/LavaMoat for JavaScript object-capability plugins
- try `isolated-vm` or QuickJS/WASM for stronger JS isolation
- consider Wasmtime/WASI when operations are compiled capsules rather than JS
