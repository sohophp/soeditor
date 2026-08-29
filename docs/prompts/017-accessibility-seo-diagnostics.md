# Phase 17 — Accessibility and SEO Diagnostics

## Status

COMPLETE.

## Goal

Add bounded, source-oriented accessibility and SEO diagnostic plugins on the
existing `DiagnosticsService` extension point without executing canonical HTML
or coupling rule semantics to Core or UI.

## Sources of truth

Implementation must preserve:

- `AGENTS.md` HTML-first, plugin-first, command-driven, and small-Core rules;
- the canonical HTML/source and parser boundaries in ADR 0008;
- the diagnostics/Problems boundary in ADR 0013;
- the public plugin SDK discipline in ADR 0019;
- the complete Phase 17 scope and deferrals in `docs/ROADMAP.md`;
- the actual 0.5.1 `@soeditor/html` and `@soeditor/html-tools` APIs.

## Required implementation

1. Add independently selectable accessibility and SEO plugins to
   `@soeditor/html-tools`. Each plugin must require the existing diagnostics
   infrastructure, register one stable provider, and release its registration
   during destruction.
2. Analyze only SoEditor-owned immutable HTML trees produced by
   `@soeditor/html`. Do not inject, render, execute, fetch, crawl, or sanitize
   source.
3. Give every rule a stable code, documented default severity, deterministic
   message, and the narrowest available source range.
4. Apply complete-document-only rules only to complete documents. Fragment
   rules must avoid assuming unavailable page, CSS, application, or rendered
   context. Inert template content must not be treated as rendered page
   content.
5. Accept per-instance immutable rule settings through editor configuration.
   Each known rule may be disabled or assigned one supported SoEditor problem
   severity. Reject malformed rule configuration with an actionable error and
   ignore no unknown rule silently.
6. Preserve registration order and the existing stale-result publication
   contract. Phase 17 must not add background validation policy; that belongs
   to Phase 18.
7. Export only intentional SoEditor-owned plugin, configuration, and rule-code
   types. No parse5 or mutable internal tree types may escape.
8. Document rule scope and limitations in the package README and architecture
   documentation after implementation is verified.

## Test requirements

Cover at minimum:

- normal complete documents and fragments;
- missing and empty values;
- rule disabling and severity overrides;
- malformed and unknown configuration;
- deterministic composition with built-in and third-party providers;
- malformed HTML parser recovery;
- custom elements, comments, SVG, MathML, and template content;
- dangerous scripts, event handlers, URLs, and embeds remaining inert;
- concurrent/stale validation behavior inherited from the registry;
- independent plugin teardown and terminal editor destruction;
- Node and browser/package consumer compatibility through repository gates.

## Explicitly deferred

- automatic or suggested source fixes;
- dynamic layout, CSS, color-contrast, focus-order, assistive-technology, or
  script-rendered analysis;
- remote requests, crawling, analytics, or ranking prediction;
- full WCAG, legal, Lighthouse, or search-engine compliance claims;
- debouncing, cancellation, provider error isolation, and Problems UX changes;
- Markdown, CSS, JavaScript, and preview-document diagnostics.

## Definition of Done

- both providers compose deterministically with existing and third-party
  providers;
- stale results cannot replace current-document problems;
- no preserved content is executed or discarded;
- public declarations contain only intentional SoEditor-owned types;
- meaningful unit, package-consumer, and browser gates pass;
- adversarial review reports Critical = 0 and High = 0;
- lint, strict typecheck, tests, and build pass.

## Completion record

Completed on 2026-08-30.

- Added independently selectable accessibility and SEO providers with stable
  codes and per-instance immutable rule configuration.
- Added normal, boundary, malformed, namespace/template, security,
  configuration, composition, teardown, packed NodeNext, and real Chromium
  coverage.
- Verified intentional public declarations with no parse5 or DOM types.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
  `pnpm security:audit` passed.
- Read-only adversarial and final release-gate review: Critical = 0, High = 0.
- Accepted Medium limitation: source-only rules intentionally cannot validate
  computed layout, CSS, runtime accessibility, remote indexing, or ranking.
