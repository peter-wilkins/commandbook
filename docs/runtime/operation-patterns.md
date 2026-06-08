# Operation Patterns

These are reusable operation patterns that appear in real automation on Linux,
Android, browsers, APIs, and physical devices.

They should be available to the planner as boring, composable building blocks.

## Wait

Pause for time, a human requirement, or an external condition.

Examples:

- wait 10 seconds for a service to start
- wait for the phone to be plugged in
- wait for the user to paste an API key
- wait until a download appears

## Poll

Repeatedly run a query until a condition is true, a timeout happens, or the user
cancels.

Examples:

- poll `docker info` until Docker is ready
- poll a local server until `/health` returns OK
- poll Android device state until the phone is unlocked
- poll email inbox until a test email arrives

## Watch

Observe a stream of changes and react when an event occurs.

Examples:

- watch a log file for an error
- watch a directory for a new file
- watch ADB devices for a phone connecting
- watch a browser tab title for a navigation result

## Verify

Check that the intended fact or effect really happened.

Examples:

- verify an Android setting changed
- verify a message appears in an outbox
- verify a server is listening on a port
- verify a file checksum

## Recover

Reconcile saved run state with outside-world state after interruption.

Examples:

- after process death, check whether an SMS was already sent
- after a crash, check whether a file write completed
- after a browser restart, check whether a form submission succeeded
- after Android Settings app switching, check whether the target setting changed

Recover should avoid repeating mutations unless idempotency is proven.

The mutation's idempotency strategy is a clue for recovery:

- `idempotent`: retry may be safe
- `at_most_once`: first prove it did not happen
- `repeatable`: repeating is acceptable
- `unknown`: pause for human recovery

## Choice Resolver

Ask the human to choose from options when the graph has more than one valid path
and cannot safely choose alone.

Examples:

- choose an email provider
- choose whether to pay for a service
- choose between a fast risky route and a slower safer route
- choose which phone to configure

The result of a choice resolver becomes a fact and the coffee grinder resumes.

## Timeout

Stop waiting or polling after a defined limit.

A timeout should produce a useful failure, not silent confusion.

## Retry

Try an operation again when the failure is likely transient.

Retries need limits and idempotency rules. Retrying a query is usually safer than
retrying a mutation.

## Backoff

Increase the wait time between retries or polls.

This matters for battery, rate limits, network usage, and politeness.

## Human Requirement

Pause because the system needs the human to do something.

Examples:

- approve a permission dialog
- enter a password
- create an API token
- plug in a USB device
- choose between risky options

## Pattern Contract

These patterns should be visible in plans.

Bad:

```text
Waiting...
```

Good:

```text
Polling Docker readiness every 2 seconds for up to 60 seconds.
Last result: permission denied connecting to /var/run/docker.sock.
Next: ask human to log out/in or run the do-now Docker shell action.
```

## Why This Matters

Real automation spends a lot of time not doing the main task.

It waits, polls, verifies, recovers, and asks the human for missing pieces. These
patterns are where the coffee grinder becomes useful: it can preserve context
through the boring gaps that normally make humans lose the thread.
