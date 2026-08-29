# ADR 0005: Core lifecycle stabilization

- Status: Accepted
- Date: 2026-08-29

## Context

The initial Phase 1 implementation exposed concrete lifecycle controls, allowed
reentrant dispatch and transaction reuse, and permitted listener errors to
interrupt required cleanup.

## Decision

`Editor` exposes narrow public capability interfaces while concrete registries
and lifecycle controls remain internal. Editor destruction is exception-safe and
shared by concurrent callers. Normal event emission reports listener failures;
mandatory lifecycle emission reports failures through `event:error` and
continues cleanup.

Transactions are created only by an editor, are single-use, and carry ownership
and base-state provenance. Synchronous reentrant dispatch is rejected rather than
queued. Successfully initialized plugins are destroyed in reverse order; plugins
that did not complete initialization do not receive `destroy()`.

Configuration accepts immutable JSON-like plain data and rejects unsupported or
cyclic values. `readonly` remains policy state and does not block administrative
`setData()` calls.

## Consequences

The unreleased concrete registry classes and transaction constructor are removed
from the package-root API. Consumers receive deterministic lifecycle and
transaction behavior without introducing a scheduler, history system, or any
Phase 2 editor feature.
