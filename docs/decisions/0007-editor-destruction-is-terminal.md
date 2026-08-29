# ADR 0007: Editor destruction is terminal

- Status: Accepted
- Date: 2026-08-29

## Context

Plugins can access their editor during construction, initialization, and ready
hooks. A plugin may therefore request destruction before `Editor.create()` has
completed. Without guarded transitions, startup could promote destroyed plugins
and transition the destroyed editor back to `ready`.

## Decision

Editor destruction is terminal. Valid transitions are:

```text
initializing -> ready -> destroying -> destroyed
initializing -> destroying -> destroyed
```

Transitions from `destroying` or `destroyed` to an operational state are
invalid. Startup checks its state after every plugin lifecycle boundary. If
destruction begins, remaining startup hooks stop, plugin lifecycle stages do not
advance, required cleanup completes, and `Editor.create()` rejects with
`EditorInitializationAbortedError` instead of returning a destroyed editor.

Startup hook waits observe destruction independently from hook settlement. If
destruction begins while an `init()` or `ready()` promise is pending, startup
waits for the existing shared destruction operation and rejects without waiting
for the hook. The hook promise remains observed so a late rejection is handled,
but late fulfillment or rejection cannot alter the aborted lifecycle outcome.

Only plugins that completed initialization before destruction began receive
`destroy()`, in reverse order and at most once.

A plugin `destroy()` hook must not await its editor's own shared `destroy()`
promise. That promise waits for the hook to complete, so awaiting it would form
a self-dependency. A hook may obtain or compare the promise without awaiting it.

## Consequences

Startup is abortable without exposing lifecycle mutation APIs or introducing a
generic state-machine abstraction. Destroy promise identity, cleanup isolation,
and all existing Phase 1 capability guards remain unchanged.
