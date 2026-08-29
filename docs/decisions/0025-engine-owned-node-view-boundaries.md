# ADR 0025: Engine-owned node-view boundaries

- Status: Accepted
- Date: 2026-08-30

## Context

Phase 23 can recognize a custom element as an atomic or readonly structured
block, but intentionally renders only an inert label. Phase 24 needs richer
plugin presentation and interaction without allowing plugin DOM to become the
document model or merging source conversion with executable rendering.

## Decision

Structured source conversion and node-view rendering remain separate
contributions. A registered node-view factory is keyed by structured node type
and receives a host-scoped browser `Document`, an immutable structured block,
readonly/selection state, and narrow command-oriented actions.

The engine creates and owns a focusable, `contenteditable=false` boundary for
every structured block. Plugin DOM mounts inside that boundary. Native DOM
mutation inside a view never updates canonical content; attribute changes,
deletion, insertion, and movement must use engine services/commands and Core
transactions. Unknown or opaque nodes never call a node-view factory.

The existing block/offset point shape represents atomic selection as the range
from offset `0` to `1` within one structured block. This retains 0.6 text
selection compatibility while permitting controlled selection restoration and
operation mapping. Public inline node views and nested editables are deferred
until a demonstrated feature can preserve deterministic mappings.

Node-view instances have explicit mount/update/destroy lifecycle. The engine
validates their returned element and destroys instances on rerender or engine
teardown, isolating cleanup failures so remaining instances are still released.

## Consequences

Plugins can create accessible framework-neutral widgets without receiving
private projection objects or source mutation authority. Atomic widgets share
history, clipboard, readonly, and selection semantics with existing visual
editing.

Whole-surface rerender may recreate views after a transaction; Phase 24 values
deterministic lifecycle and correctness over speculative incremental DOM
reconciliation. Framework adapters, nested editor ownership, inline widgets,
and cross-editor drag/drop remain later decisions.

The self-contained global necessarily includes the public runtime and grows by
about 4.7 kB raw while remaining below the existing 410 kB gzip guard. The raw
global guard moves from 1.25 MB to 1.26 MB, and the full Playground chunk guard
from 1.00 MB to 1.01 MB. Modular ESM remains the production size path; these
small explicit increases retain tight regression detection without hiding the
cost of the new capability.
