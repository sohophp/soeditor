# Phase 7 Implementation Specification — HTML Diagnostics and Formatting

## Status

Active implementation specification for Phase 7 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–6 implementation.

## Goal

Add UI-independent HTML problem analysis and deliberate Prettier formatting so
source editing becomes a developer-oriented environment.

## Package boundary

Create `@soeditor/html-tools`, a framework-neutral feature package depending on
public `@soeditor/core` and `@soeditor/html` APIs. Prettier is a focused runtime
dependency of the formatting implementation and must not enter Core or leak its
types through public SoEditor declarations.

## Problems model

Define SoEditor-owned immutable public types for:

```text
ProblemSeverity = error | warning | info | hint
Problem = severity + message + code + provider + optional SourceRange
DiagnosticProvider = stable ID + source-to-problems function
```

Expose a per-editor typed diagnostics service that can:

- register/unregister providers with duplicate detection;
- validate an explicit source or the current canonical source;
- expose the latest successfully published current-source problems.

Providers may be asynchronous. Preserve deterministic provider/diagnostic
ordering. Provider failures must remain observable and must not replace the
last successfully published result. Stale asynchronous validation must not
publish problems for an older document as current.

## Built-in diagnostics

Register providers for:

- all `@soeditor/html` parser diagnostics;
- duplicate HTML `id` values;
- images missing an `alt` attribute;
- complete HTML documents whose root `html` element lacks `lang`.

Use parser-owned UTF-16 source ranges where available. Unknown/custom elements,
CMS comments, SVG, MathML, and templates are not errors merely because they are
unknown to SoEditor.

## Commands

`DiagnosticsPlugin` registers:

```text
document.validate
```

It returns the immutable problem list for canonical source.

`HtmlFormattingPlugin` registers:

```text
document.format
```

Formatting is asynchronous, explicit, and transaction-backed. It validates
first, rejects parser-invalid source without mutation, formats with Prettier's
HTML parser/plugin, and commits only when output differs. A concurrent source
change must make the operation fail as stale rather than overwrite newer text.

## Formatting API

Expose only a narrow SoEditor-owned option type (for example print width, tab
width, tabs, single-attribute-per-line, and HTML whitespace sensitivity). Fully
validate arguments. Do not expose Prettier `Options`, plugins, or AST values.

Use browser-compatible Prettier standalone plus its HTML plugin and externalize
the dependency from the library bundle. Pin the runtime version because
formatter output is version-sensitive.

## Tests

Cover normal, boundary, failure, and adversarial behavior:

- provider registration/disposal/duplicates and deterministic ordering;
- async provider failure and stale validation publication;
- parser ranges and every selected structural warning;
- custom elements, comments, SVG, template, and unsafe markup neutrality;
- format argument validation and parser-invalid refusal;
- exact semantic/custom markup survival through deliberate formatting;
- formatting transactions, history undo/redo, no-op behavior, and stale source;
- public declarations and packed NodeNext/ESM consumption;
- real-browser validate/format behavior in source and visual modes.

## Documentation and ADR

Add an ADR for the provider registry/problem model and pinned browser Prettier
boundary. Update architecture and README for implemented behavior.

## Explicitly deferred

Do not build the Phase 8 Problems panel, toolbar, status bar, extensible UI,
automatic format-on-type/save, generic lint-rule configuration, fixes/actions,
workers, Markdown formatting, or preview integration.

## Definition of Done

- diagnostics are independently consumable without a UI;
- parser and selected structural problems use SoEditor-owned types/ranges;
- `document.validate` and `document.format` are command-driven;
- invalid source and concurrent newer source cannot be overwritten;
- Core and public declarations remain independent of Prettier;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and browser tests pass.
