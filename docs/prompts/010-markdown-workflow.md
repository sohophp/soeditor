# Phase 10 Implementation Specification — Markdown Workflow

## Status

Active implementation specification for Phase 10 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–9 implementation.

## Goal

Make Markdown an intentional canonical document format with exact source
editing and isolated preview, not an HTML export checkbox.

## Core format boundary

Activate the already reserved `markdown` document format and add `markdown` to
the requested mode union. Markdown documents default to Markdown mode. Core
continues to store opaque canonical source and does not parse Markdown.

HTML visual/source engines must reject Markdown documents before host mutation.
The Markdown engine must likewise reject non-Markdown documents.

## Parser and conversion

Use pinned micromark 4.0.2 for CommonMark-compliant Markdown-to-HTML rendering.
Raw embedded HTML is preserved in rendered output; dangerous URL protocols
remain disabled by micromark. Execution safety belongs to the Phase 9 sandboxed
Preview boundary.

Use pinned Turndown 7.2.4 for the deliberate HTML-to-Markdown bridge. Return an
explicit conversion result with loss notices. Preserve custom/namespaced raw
elements where practical, but report comments, document chrome, attributes, and
unsupported constructs that may be normalized or lost. Do not promise a
lossless round trip.

Third-party parser/AST types must not cross public SoEditor declarations.

## Markdown source editing

Create framework-neutral `@soeditor/markdown` with a browser CodeMirror 6
source engine using the official Markdown language package. It must provide:

- exact canonical Markdown synchronization;
- syntax highlighting;
- a typed focus service;
- command-driven Markdown mode;
- readonly behavior;
- shared Core undo/redo history and source grouping;
- external source synchronization;
- duplicate attachment and terminal lifecycle behavior.

Markdown has no parser-error diagnostic model in this phase.

## Preview bridge

Extend the Preview engine with a narrow SoEditor-owned content-renderer
interface selected by canonical document format. The Markdown package provides
a renderer supporting Markdown and HTML passthrough, so the existing sandbox,
CSP, templates, styles, and lifecycle remain the only execution boundary.

## UI and playground

Register a Markdown toolbar contribution, but do not add it to the normal HTML
default toolbar. Provide a Markdown playground route/configuration demonstrating
create, edit, shared undo/redo, raw HTML passthrough, and Preview return.

## Tests

Cover normal, boundary, failure, and adversarial behavior:

- Markdown Core defaults and HTML/Markdown engine format guards;
- CommonMark structures, code, links, and raw HTML rendering;
- dangerous protocol behavior and sandboxed raw executable HTML;
- explicit HTML-to-Markdown loss reports and custom element handling;
- exact CodeMirror edits, readonly, history, external changes, and mode switch;
- Markdown Preview templates, refresh, and return mode;
- duplicate attachment, cleanup, and retained service references;
- public declarations and packed NodeNext/ESM consumption;
- complete real-Chromium Markdown editing and preview workflows.

## Documentation and ADR

Add an ADR for canonical Markdown, parser choice, raw HTML, and conversion
lossiness. Update architecture and README for implemented behavior.

## Explicitly deferred

Do not add GFM extensions, WYSIWYG Markdown, AST plugin APIs, Markdown linting,
frontmatter interpretation, MDX, perfect HTML round trips, format conversion on
mode switch, split view, or Markdown-specific formatting toolbar commands.

## Definition of Done

- users can create/edit a canonical Markdown document and preview it;
- raw HTML survives Markdown source and renders only inside isolated Preview;
- conversion loss is explicit;
- incompatible engines refuse attachment without data loss;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and browser tests pass.
