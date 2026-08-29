# ADR 0024: Editor-owned structured schema contributions

- Status: Accepted
- Date: 2026-08-30

## Context

The 0.6 visual engine has a private fixed schema for paragraphs, simple lists,
text marks, and links. Everything else is safely preserved as opaque HTML, but
plugins cannot identify a custom element as structured content without private
engine changes. SoEditor 0.7 needs a public extension boundary before node
views, tables, media, or annotations can be built on it.

Adopting another editor's document model would change SoEditor's HTML-first
source authority and expose a large speculative API. Letting converters create
DOM would also merge preservation, rendering, and execution concerns.

## Decision

`@soeditor/engine` owns the structured visual representation and a per-editor
`StructuredEditingPlugin` registry. Plugins register immutable block
conversion definitions with unique contribution IDs and structured node types.
Each definition explicitly matches a SoEditor HTML node, converts it to a
bounded SoEditor structured block, and serializes that block back to a SoEditor
HTML node.

The registry rejects duplicate identities and ambiguous source matches. The
visual engine seals and snapshots the registry when it attaches, so one editing
session uses a deterministic schema. Registration callbacks receive no browser
DOM, Editor internals, or executable rendering capability.

The initial public custom-block behavior is `atomic` or `readonly`. Both are
structured and operation-addressable but project as inert placeholders.
Existing paragraphs remain editable. Unmatched content remains a distinct
opaque-preserved value. Public DOM node views and nested editable behavior are
deferred to Phase 24.

The bounded paragraph/list/mark/link subset accepted in 0.6 remains the engine
compatibility baseline so existing documents and minimal integrations do not
become opaque merely because a new registry is present. Feature packages still
own their user-triggerable commands; new structured element shapes belong to
the feature plugin that registers their conversion. Moving every compatibility
tag into separately optional schema plugins would be a breaking behavior
change and is not required to prove this extension boundary.

Structured editing results additionally describe the bounded changes performed
by current operations and provide deterministic point mapping. Core
transactions and canonical HTML source remain authoritative; 0.6 snapshot
history is not replaced by a speculative collaborative operation log.

## Consequences

Third-party plugins can preserve and identify custom elements using public,
framework-neutral types without gaining access to private projection state.
Schema behavior is isolated per editor and stable for an attached engine.
Unsupported HTML continues to round-trip opaquely, and source-mode replacement
and invalid-source locking retain their existing semantics.

The first registry is intentionally block-oriented. Inline custom schemas,
node-view DOM factories, nested editing, table selection, and operation
inversion require demonstrated later-phase behavior rather than expansion of
this contract in advance.
