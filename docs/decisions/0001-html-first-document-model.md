# ADR 0001: HTML-first document model

- Status: Accepted
- Date: 2026-08-29

## Decision

The canonical Phase 1 document is immutable source data. `EditorDocument`
retains its format, source, revision, and metadata. HTML is the only format that
can currently be instantiated; the public format type reserves Markdown without
providing a parser or runtime implementation.

Unknown HTML is preserved as source. Preservation does not grant execution.
