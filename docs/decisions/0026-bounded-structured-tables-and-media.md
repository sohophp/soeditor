# ADR 0026: Bounded structured tables and media

- Status: Accepted
- Date: 2026-08-30

## Context

Phase 23 introduced public structured source conversion and Phase 24 introduced
engine-owned node-view boundaries. Tables and media are the first built-in
features complex enough to prove that those extension points support real
editing without making view DOM canonical or adding feature behavior to Core.

Tables also need rectangular selection and structural operations, while media
needs a safe preview distinct from preserved source and a replaceable file
picker. A general spreadsheet model, nested editor runtime, or Core-owned
upload system would exceed the demonstrated requirements.

## Decision

`TablePlugin` and `MediaPlugin` live in `@soeditor/rich-text`. Each registers a
structured block conversion, a framework-neutral node view, and commands. They
read an immutable selected block through `VisualEditingService` and replace its
source-shaped attributes and children through one transaction-backed
`replace-structured-content` operation. Plugins never mutate the projection.

The table model is deliberately bounded to 100 rows, 100 columns, and 1000
logical cells. It validates a rectangular grid, including `rowspan` and
`colspan`, before editing. Row and column changes require split cells; merge and
split rules are explicit. A view-local rectangular range supports pointer and
arrow-key interaction, while the same commands accept an explicit public range
for third-party UI. Clipboard HTML remains semantic table HTML and untrusted
command matrices and clipboard sources are bounded and validated.

The media model supports one direct `img` and an optional `figcaption` inside a
`figure`. Source attributes remain canonical and preserved. The node view
creates only controlled DOM properties for `src`, `alt`, dimensions, and plain
caption text. Executable URL schemes and non-image data URLs are not loaded;
event-handler attributes and unsupported children remain source-only and inert.

`FileManagerPlugin` depends only on the existing typed FileManager service and
delegates results to either `image.insert` or `media.insert`. SoFinder remains
an optional adapter and neither rich-text feature knows its implementation.

## Consequences

Tables and media use the same public schema, node-view, command, service,
transaction, history, readonly, and teardown paths available to external
plugins. Core remains DOM-free and feature-free. Unsupported meaningful table
or figure structures are preserved but shown as inert unsupported widgets.

Table selection is currently view-local and resets when a transaction rebuilds
the projection. Media captions are edited as plain text; existing caption
markup is retained until the caption itself is changed. Spreadsheet formulas,
office-paste parity, arbitrary embeds, nested editable captions/cells, and
uploads remain deferred.

The self-contained global grows from 1,254.55 kB raw / 404.98 kB gzip to
1,282.04 kB raw / 412.66 kB gzip, and the full Playground chunk grows from
1,005.87 kB to 1,033.29 kB. The explicit guards move to 1.29 MB raw, 415 kB
gzip, and 1.04 MB for the Playground chunk. Focused ESM tree shaking remains
the production-size path and its narrow consumer audit remains independently
guarded.
