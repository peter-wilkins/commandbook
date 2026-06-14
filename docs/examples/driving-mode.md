# Driving Mode Example

Captured on 2026-06-14.

Driving Mode is an example Commandbook domain for low-attention phone use while
driving. It is not a special assistant. It is a set of commands that Field Relay
or another runtime can expose safely.

## Constraint

The driver cannot safely fiddle with the phone. Some cars may force Gemini as
the default assistant, so Commandbook should not depend on owning the assistant
slot.

## Candidate Commands

### `runninglate`

Intent: tell someone the driver is running late.

Arguments:

- `contact`: person or group. V0 defaults to Peter's own WhatsApp test channel.
- `destination`: optional destination; default can come from active navigation.
- `eta`: optional ETA text. V0 defaults to `10 minutes`.
- `message`: optional extra text.

V0 behaviour:

- WhatsApp only.
- No SMS fallback.
- No confirmation button for the trusted self-test channel.
- Default message: `Running late, ETA 10 minutes.`

The platform adapter must report whether WhatsApp actually sent the message or
only opened a prefilled chat.

Dry run for non-test channels must show:

- recipient
- channel
- destination used
- ETA or reason ETA is unavailable
- exact message text

### `sendeta`

Intent: send a current ETA to a named contact.

Arguments:

- `contact`: required person or group.
- `destination`: optional.

Dry run must show recipient, route source, ETA, and exact message.

### `remember`

Intent: save a local note for later.

Arguments:

- `text`: required note text.

This is safe to run locally without network. It should preserve the note even if
the bridge is offline.

### `music`

Intent: control the current media session.

Arguments:

- `action`: required; one of `pause`, `resume`, `next`, `previous`, `duck`.

This should use Android media APIs where available. It should not depend on a
specific music app.

## Operation Sketch

Queries:

- read current navigation destination
- estimate travel time
- read current media state
- read known contact route

Mutations:

- send message
- start navigation
- pause or resume media
- save local note

## Safety Notes

Read-only commands can auto-run. Message, navigation, and call mutations need a
dry run or confirmation. If safe confirmation is unavailable while moving, save
the prepared action and ask later.
