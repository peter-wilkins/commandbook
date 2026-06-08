# Research Note: Deno Permissions

This is a research note, not a technology decision.

Sources:

- https://docs.deno.com/runtime/fundamentals/security/
- https://docs.deno.com/api/deno/~/Deno.permissions

JavaScript sandbox alternatives are captured in
[`javascript-sandbox-options.md`](javascript-sandbox-options.md).

## Why It Matters

Deno has a useful permission model for Commandbook to study.

By default, Deno code does not automatically get broad access to sensitive
runtime features. Access is granted explicitly with permissions such as:

- read files
- write files
- use network
- read environment variables
- run subprocesses
- use system information APIs
- use FFI/native addons

The important product idea is not "use Deno" and not "copy Deno". The important
idea is that execution can declare the outside-world access it needs.

## Commandbook Relevance

Commandbook capabilities can be inspired by this kind of shape:

```text
read:/path/to/file
write:/path/to/output
net:api.example.com
env:API_KEY_NAME
run:ffmpeg
device:android-sms
account:cloudflare-email
```

This maps naturally to:

```text
Operation -> required capabilities
Driver -> platform permissions
Runtime -> active capability grants
Coffee Grinder -> broker check + prompt/checkpoint/resume when missing
```

## Useful Lessons

1. Permissions should be explicit, narrow, and inspectable.
2. The runner should know which capabilities are missing before executing.
3. Interactive prompts are useful, but they must be checkpointed so work can
   resume later.
4. Broad "allow all" permissions defeat the point.
5. Permission prompts should be generated from the plan, not discovered only
   after a mutation has half-run.

## Open Questions

1. Should Commandbook capabilities look like Deno flags, e.g.
   `--allow-net=api.example.com`?
2. Should capability prompts happen lazily when the graph reaches the missing
   capability, or should the planner preflight likely requirements?
3. How do we represent platform permissions separately from user grants?
4. Which parts of the Deno permission model are good inspiration, and which
   parts are too runtime-specific for Commandbook?
