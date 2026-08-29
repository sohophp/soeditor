# ADR 0009: Controlled visual editing projection

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 3 needs a browser editing surface without making contenteditable DOM
mutations authoritative, losing unsupported HTML, or executing preserved unsafe
markup. The first editable subset is limited to paragraphs, text, strong, and
emphasis.

## Decision

`@soeditor/engine` owns a short-lived structured editing representation derived
from the `@soeditor/html` tree. Supported paragraph and inline content becomes
editable blocks and marked text runs. Unsupported elements, attributed mark
elements, comments, and custom HTML remain immutable opaque tree values.

The contenteditable DOM is a controlled projection. Supported content is
created with explicit DOM APIs. Opaque values render as inert,
`contenteditable=false` placeholders; their preserved markup is never injected
into the editing surface. Complete HTML documents remain canonical source and
use a locked visual placeholder until full-document visual editing is designed.

`beforeinput` is the user-input boundary. Supported inputs are prevented from
performing native authoritative mutations, translated to editing operations,
serialized through `@soeditor/html`, and committed through Core transactions.
Unsupported mutating input is prevented. A mutation observer restores the
controlled projection after out-of-band DOM changes.

The Phase 3 selection model uses DOM-independent block indexes and UTF-16 text
offsets. A bridge maps these points to and from native browser selection. It is
a foundation, not the final history/selection design.

## Consequences

Unknown HTML and executable-looking source remain preserved without gaining
execution permission. Visual behavior is deterministic and testable, and Core
remains DOM-free. Phase 3 pays for this boundary with explicit model conversion,
projection, and selection mapping.

The initial engine normalizes supported markup semantically during edits,
rerenders the controlled surface after each transaction, and supports only a
narrow selection/keyboard subset. Incremental rendering, history, clipboard,
advanced selection, rich-text feature commands, and editable full documents are
deferred to their roadmap phases.
