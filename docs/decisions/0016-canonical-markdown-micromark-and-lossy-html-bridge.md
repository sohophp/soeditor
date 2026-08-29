# ADR 0016: Canonical Markdown, micromark, and lossy HTML bridge

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 10 must make Markdown a first-class source format with predictable parsing,
raw HTML passthrough, preview, and a practical HTML bridge. Reimplementing the
Markdown grammar would be error-prone, while treating Markdown as generated HTML
would lose source authority.

## Decision

Core accepts the previously reserved `markdown` document format and requested
mode while continuing to store source opaquely. Markdown is canonical for a
Markdown editor instance; Visual/Source/Preview are projections and never
silently change its format.

`@soeditor/markdown` uses pinned micromark 4.0.2 to compile CommonMark to HTML.
It enables raw HTML preservation but not dangerous URL protocols. Rendered HTML
is not considered sanitized and executes only through the Phase 9 empty-sandbox
iframe and fixed CSP. The package uses CodeMirror 6's Markdown language support
for exact source editing.

A narrow Preview content-renderer interface chooses projection by canonical
format. The Markdown renderer also passes canonical HTML through, allowing one
preview host configuration to support either format without Preview depending
on the Markdown package.

Deliberate HTML-to-Markdown conversion uses pinned Turndown 7.2.4. SoEditor
returns Markdown together with explicit loss notices. Custom/namespaced elements
are retained as raw HTML where practical; comments, document chrome, attributes,
invalid-input recovery, and unsupported structures may be lost or normalized.
No lossless round-trip contract is made.

## Consequences

Markdown text remains exact and independently editable. Parser and CodeMirror
types do not enter Core or SoEditor public declarations. HTML engines reject a
Markdown document instead of interpreting it as HTML.

The initial dialect is CommonMark without GFM, MDX, frontmatter semantics, or
Markdown diagnostics. micromark documents that enabling raw HTML is unsafe when
output is inserted into an executing DOM; SoEditor relies on Preview isolation,
not the parser, for execution safety.

## References

- <https://github.com/micromark/micromark>
- <https://codemirror.net/examples/basic/>
