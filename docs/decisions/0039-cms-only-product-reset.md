# ADR 0039: CMS-only product reset

## Status

Accepted on 2026-09-01.

## Context

SoEditor accumulated HTML Source, Markdown, Preview, developer tools, review,
framework adapters, layouts, plugin tooling and multiple visual projections.
Those capabilities demonstrated useful architecture, but the aggregate product
became broader and heavier than the required use case: editing HTML content in
a website CMS administration interface.

The completed all-features browser global measures 2.214 MB raw and 649.71 kB
gzip. The package root also publicly re-exports optional product families. A
passing tree-shaking example does not make that all-features surface a suitable
default for a lightweight CMS editor.

## Decision

The active product is one classic CMS HTML WYSIWYG editor with optional lazy
HTML Source mode.

The default entry, preset, UI and browser artifact will exclude Markdown,
comments, revisions, Developer Visual, Preview, split layouts, framework
adapters, plugin scaffolding, email tools, AI and collaboration.

Existing released packages are not deleted automatically. They become optional
or compatibility-only until ordinary SemVer and support policy permits removal.

SoEditor retains the useful architectural constraints established earlier:

- canonical HTML and semantic preservation;
- separation of preservation from execution;
- command- and transaction-driven changes;
- controlled editing representation rather than `execCommand()`;
- plugin/service boundaries and a small framework-neutral Core;
- instance isolation, explicit lifecycle and observable errors.

## Consequences

- Default artifact size and runtime cost become release-blocking product
  requirements.
- New platform breadth is rejected even when technically easy.
- Historical packages may remain in the monorepo without being part of the
  active product.
- Tests and documentation will be reorganized around one continuous CMS author
  journey.
- Package removal requires a separate compatibility decision; removing a module
  from the default import graph does not require an immediate breaking release.

## Superseded direction

This decision supersedes earlier roadmap language that treated Markdown,
Developer Visual, review workflows, arbitrary multi-pane workspaces, framework
adapters, plugin marketplaces, AI or collaboration as future product goals.
Earlier ADRs remain valid only for the implementation or compatibility surfaces
they document and may not expand the current product boundary.
