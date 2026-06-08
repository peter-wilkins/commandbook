# CLI Discovery And Help

Commandbook should be easy to inspect before it becomes powerful.

The first discovery commands are:

```bash
commandbook list commands
commandbook list runs
commandbook list running
commandbook list events
commandbook status [run-key]
commandbook help [command]
commandbook help [command] --long
commandbook emit wifi.available --fact network_kind=wifi
```

`list commands` shows available command recipes.

`list runs` shows saved local runs in `.commandbook`.

`list running` filters saved runs to those that are not terminal.

`list events` shows the local runtime event log.

`status` prints the latest run by default, or a specific run if given a key or
run id suffix.

`emit <event-type>` appends a runtime event and wakes paused runs that subscribed
to that event.

`help <command>` reads recipe metadata. `help <command> --long` also shows the
goal and queued operations.

## Living Docs Direction

The docs should become living docs.

V0 help reads structured recipe metadata:

```json
{
  "name": "git_push_current_branch",
  "description": "Push the current branch.",
  "usage": "commandbook git_push_current_branch --yes",
  "docs": ["docs/runtime/reusable-core.md"]
}
```

Later, operation implementations can expose Rustdoc-style comments or generated
API docs into `help --long`. The important rule is that help should come from
the same artifacts the runner and tests use, not a separate stale manual.

Do not overbuild this yet. The useful pressure is:

- can Peter discover what commands exist?
- can Peter see what is currently running?
- can Peter inspect what a command will try to do?
- can a future agent follow links from help into the deeper docs?
