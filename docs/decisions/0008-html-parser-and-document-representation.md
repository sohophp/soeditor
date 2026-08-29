# ADR 0008: HTML parser and document representation

- Status: Accepted
- Date: 2026-08-29

## Context

SoEditor needs standards-oriented parsing, malformed-HTML recovery, diagnostics,
source locations, and semantic serialization without coupling its extension API
to a third-party parser AST.

## Decision

`@soeditor/html` uses parse5 as internal parsing and serialization
infrastructure. Internal adapters convert between parse5 values and a
SoEditor-owned discriminated HTML tree containing documents, fragments,
elements, text, comments, and doctypes. Source locations use SoEditor-owned
one-based line/column and zero-based offset types.

Custom and unknown elements remain ordinary `HtmlElement` values. Unknown,
custom, and namespaced attributes are retained. HTML, SVG, and MathML namespaces
remain distinct, and `<template>` content is mapped deliberately.

HTML source is the canonical persistence representation; the tree is the
structured parsed representation. Semantic preservation is required, but
byte-for-byte source preservation is not. Parser-synthesized nodes receive no
invented locations.

Parsing and preservation are separate from sanitization, rendering, and
execution. No general `RawHtmlNode`, editing identity, or tree mutation API is
introduced in Phase 2.

## Consequences

Future consumers work against stable SoEditor types and can change parser
infrastructure without an extension-API migration. The package pays for this
boundary with explicit, thoroughly tested conversion adapters. Source formatting
and some malformed input normalize according to HTML parsing rules.
