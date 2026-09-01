# CMS performance budgets

## Status

Active performance policy for the CMS-only roadmap. Historical measurements are
retained below only as the starting point for Phase 58.

## Product measurement boundary

The primary artifact is the documented default CMS WYSIWYG entry. The following
costs are measured separately and cannot be hidden inside its budget:

- optional HTML Source and CodeMirror;
- file-manager adapters;
- compatibility Markdown, Preview, comments, revisions and layouts;
- React/Vue adapters and development tooling;
- Playground and test fixtures;
- historical all-features browser global.

Tree shaking is useful but is not a substitute for a narrow default package and
CMS-specific browser global.

## Current baseline

Before the product reset, the complete global measures approximately:

| Artifact                       |      Raw |      Gzip |          CSS |
| ------------------------------ | -------: | --------: | -----------: |
| historical all-features global | 2.214 MB | 649.71 kB | 29.11 kB raw |

That artifact includes product families no longer in scope and is not an
acceptable future CMS target. Phase 58 must record the new default CMS and
Source-enabled baselines before final numeric budgets are frozen.

## Required measurements

### Distribution

- default ESM consumer JavaScript and CSS;
- default CMS browser-global raw and gzip sizes;
- optional Source chunk raw and gzip sizes;
- module/import inventory proving excluded families are absent;
- parse/compile cost where supported by the test environment.

### Browser interaction

- cold and warm create-to-editable time;
- first focus and first input;
- continuous typing and composition latency;
- selection and toolbar-state update latency;
- link/image/table dialog opening and apply;
- Word-style paste cleanup and large plain-text paste;
- table insertion, row/column edits and cell navigation;
- first Source activation when enabled;
- repeated create/destroy and retained resources.

### Documents

Use real semantic CMS fixtures, not repeated empty paragraphs only:

- small: approximately 10 KiB;
- normal large: approximately 100 KiB;
- stress: approximately 500 KiB;
- table stress: bounded 400-cell document;
- mixed stress: headings, lists, links, images, tables, comments, custom elements
  and inert unsafe source.

## Budget rules

- Phase 58 establishes a reproducible CMS baseline; subsequent changes may not
  increase it without an owner-reviewed product justification.
- A new feature does not automatically receive a larger budget.
- Ordinary local typing must not introduce a complete-document reparse or
  surface rebuild.
- Interaction gates must report distributions or repeated samples, not a single
  best run.
- CI ceilings may account for shared-host variance, but the document must also
  record a representative reference measurement.
- Optional chunks are counted when the optional feature is activated and remain
  outside default startup.
- Memory qualification includes tasks, listeners, observers, detached DOM and
  heap, not heap alone.

## Existing deterministic gate

Run:

```bash
pnpm test:performance
```

The existing Node gate covers Core startup/teardown, canonical input, table
operations and historical compatibility scenarios. Phase 58 will add the
CMS-specific artifact inventory; Phases 59–62 will replace overly generous
four-second interaction ceilings with measured CMS budgets.

Release distribution remains checked by:

```bash
pnpm test:consumer
pnpm test:distribution
pnpm test:release
```

Until the new CMS global exists, the legacy 2.25 MB raw / 665 kB gzip guard is
only a compatibility regression check. It is not evidence that SoEditor is
lightweight.

## Performance review checklist

For every runtime change record:

1. affected CMS journey;
2. modules added to default and optional graphs;
3. raw/gzip/CSS delta;
4. startup and interaction delta;
5. DOM/render/parse behavior changed;
6. resources created and cleanup proof;
7. focused and full verification commands.
