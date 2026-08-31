# ADR 0038 — WYSIWYG product and qualification contract

## Status

Accepted for the post-1.1 WYSIWYG completion program. This decision clarifies
and extends ADR 0036 and ADR 0037; it does not reverse them.

## Context

The repository has an independent WYSIWYG engine, but historical CMS phases,
Developer Visual capabilities, command-level tests, and Classic demo assertions
have been used interchangeably when describing completion. That makes a
toolbar button, a canonical-source change, or a Developer Visual test look like
proof of a complete WYSIWYG interaction even when the visible authoring behavior
is missing or incorrect.

The architecture documentation also assigned the independent engine an
unregistered Phase 55 label even though the maintained roadmap ended at Phase 48. That numbering obscured the actual implementation and qualification state.

## Decision

- `docs/wysiwyg-editor.md` is the normative WYSIWYG product, interaction, and
  qualification specification.
- WYSIWYG and Developer Visual remain independent products. No feature inherits
  WYSIWYG completion from a Developer Visual implementation or test.
- Existing WYSIWYG behavior is a requalification baseline. A feature is complete
  only after its WYSIWYG-specific UI, visible DOM, canonical HTML, history,
  Source round-trip, lifecycle, accessibility, and relevant browser evidence
  pass.
- New work follows the registered post-1.1 roadmap phases. Architecture sections
  may describe named capabilities but must not invent phase numbers absent from
  `docs/ROADMAP.md`.
- When an interaction decision is unclear, research current official CKEditor 5
  behavior first. CKEditor 4, TinyMCE 8, and Jodit 4 are secondary references for
  proven CMS workflows. SoEditor learns behavior and tradeoffs, never copies
  implementation code or public APIs.
- Official documentation and runnable upstream demos are evidence sources.
  Screenshots alone are not sufficient to define behavior.
- Each feature slice begins with a real UI browser test and has an explicit
  command/service and HTML contract. Direct command tests remain necessary but
  are not sufficient.
- The root demonstration may label only verified WYSIWYG capabilities as
  complete.

## Consequences

Roadmap and status claims become more conservative, and some previously
described “delivered” CMS capabilities must be requalified for WYSIWYG. This
adds testing work but prevents Developer Visual constraints and demo glue from
silently determining author-facing behavior. The independent WYSIWYG package
can evolve toward a coherent editor rather than a collection of patched
surface-specific cases.
