# 1.0 qualification evidence

Phase 35 qualified the frozen 1.0 contract with executable evidence. This is a
regression record, not a claim of universal device, browser, assistive-
technology, security, or performance certification.

## User and integrator journeys

| Journey                   | Executable evidence                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Ordinary HTML author      | `editor-ui.spec.ts`, `visual-editing.spec.ts`, `table.spec.ts`, `media.spec.ts`      |
| HTML developer            | `developer-tools.spec.ts`, `diagnostics-configuration.spec.ts`, `split-view.spec.ts` |
| Markdown author           | `markdown.spec.ts`, Markdown/Preview split scenarios                                 |
| CMS and SoFinder          | `release-hardening.spec.ts`, `file-manager.spec.ts`, CMS Playground route            |
| Custom widget/plugin      | `node-views.spec.ts`, packed widget consumer, generated plugin consumer              |
| Comments/revisions/review | `comments.spec.ts`, `revisions.spec.ts`, governance adapters                         |
| Workspace recovery        | `workspace.spec.ts` and 14 focused Workspace unit tests                              |
| React and Vue             | SSR unit tests and `framework-adapters.spec.ts` real-browser lifecycle               |
| ESM/NodeNext/Vite/CDN     | packed 23-package consumer, narrow tree-shaking, browser global smoke                |

The scenarios use public package roots. Source, Markdown, Preview, framework,
plugin-tooling, and experimental widget/table/media paths remain separated by
their documented dependency and execution boundaries.

The complete journey evidence is distributed across `comments.spec.ts`,
`developer-tools.spec.ts`, `diagnostics-configuration.spec.ts`,
`distribution.spec.ts`, `editor-ui.spec.ts`, `file-manager.spec.ts`,
`framework-adapters.spec.ts`, `markdown.spec.ts`, `media.spec.ts`,
`node-views.spec.ts`, `qualification.spec.ts`, `release-hardening.spec.ts`,
`revisions.spec.ts`, `split-view.spec.ts`, `table.spec.ts`,
`visual-editing.spec.ts`, and `workspace.spec.ts`.

## Accessibility

Automated axe WCAG A/AA scans cover primary Visual, Source, Markdown, Problems,
dialog, and outer Preview UI. Deterministic browser tests additionally cover:

- native names, roles, live status/log regions, iframe titles, and duplicate IDs;
- keyboard command, dialog, table, node-view, review, split-resize, focus, and
  Escape-return paths;
- dark-theme primary action contrast;
- visible split-separator focus in forced-colors mode;
- reduced-motion mode with no SoEditor animation/transition (the standard
  CodeMirror text caret continues to blink);
- readonly controls, dynamic review policy, and lifecycle cleanup.

The current environment does not provide a human screen-reader session, switch
control, voice control, zoom/reflow lab across devices, or dedicated Firefox/
Safari accessibility runs. Therefore SoEditor does not claim WCAG certification
or complete assistive-technology conformance.

## Security

Browser tests verify that preserved scripts, handlers, unsafe links/embeds,
clipboard/drop HTML, FileManager output, UI messages, and Preview templates do
not bypass controlled rendering. Preview uses an empty sandbox and fixed CSP.
Source and Markdown verify application CSP nonces in isolated documents.
Dependency audit, script-disabled package inspection, exact export maps,
provenance metadata, and publication dry-run cover the local supply-chain gate.

The complete threat model and residual host risks are in
[`security.md`](security.md).

## Performance, memory, and lifecycle

Node gates measure 5,000-paragraph canonical replacement, 500 mapped comments,
three projections, 400-cell tables, Workspace recovery, Core startup/teardown,
and explicit-GC retention after 2,000 destroyed editors. Chromium measures
1,000 real Visual paragraphs, `beforeinput`, 400-cell table rendering, and
repeated Editor/Visual/UI lifecycles with DOM residue checks.

Budgets are generous regression thresholds for shared CI, not end-user latency
or memory promises. See [`performance.md`](performance.md).

## Reproduction

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm release:check-license
pnpm security:audit
pnpm release:dry-run
pnpm release:check-registry
```

Publication and external npm/CDN verification remain separate owner-authorized
operations.
