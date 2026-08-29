# ADR 0030: Explicit workspace lifecycle and bounded recovery

- Status: Accepted
- Date: 2026-08-30

## Context

Applications currently create an Editor and independently attach Visual,
Source, Markdown, Preview, UI, and layout handles. That preserves ownership but
requires every framework adapter to reproduce startup, reverse teardown,
controlled-value, and failure behavior. A global mount helper or DOM discovery
would hide dependencies and make SSR and multi-instance behavior fragile.

## Decision

Add a framework-neutral application controller in `@soeditor/workspace`. The
host supplies one Editor creator and an ordered list of attachment factories.
Factories receive only the Editor, an abort signal, and the recovery number.
The workspace cleans partial mounts, destroys attachments in reverse order,
and destroys the Editor last. It does not choose or discover DOM hosts.

Value policy is explicit and exclusive. Controlled workspaces accept external
`setValue()` updates and emit transaction-level changes asynchronously so a
synchronous parent echo cannot reenter Core dispatch. A private transaction
marker suppresses external-value feedback. Uncontrolled workspaces accept only
an initial value.

Recovery is opt-in and explicitly triggered by the application. The controller
captures canonical source on every document transaction, tears down the failed
instance, and recreates from that source. A sliding time window limits restart
rate. Cleanup failure, restart failure, or limit exhaustion becomes observable
terminal state with the last source retained. There is no global error handler,
hidden persistence, or blank fallback.

## Consequences

- framework adapters can remain thin lifecycle bindings in Phase 31;
- host selection of surfaces, services, elements, and editor configuration
  remains visible and testable;
- recovery protects in-memory canonical source but cannot promise durable,
  cross-tab, process-crash, or backend recovery;
- attachment factories must honor abort signals and own complete cleanup;
- runtime crashes must be reported deliberately with `reportFailure()`.
