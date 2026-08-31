# WYSIWYG completion and release decision

## Decision

The Phase 49–56 implementation program is complete. The local `1.1.0`
candidate is **GO for continued integration and Chromium-based CMS evaluation**
and **NO-GO for production publication** until Firefox and WebKit/Safari
qualification can run on a compatible host.

No package was published, tagged, or deployed by this program.

## Product result

- WYSIWYG is an independent authoring surface, not Developer Visual with a
  different label or decoration layer.
- The direct fixture covers native caret/selection/input, formatting, lists,
  links, tables, assets, uploads, rich cell paste, video properties, Source,
  Preview, seven layouts, counters, content styles, special characters,
  accessibility, security, readonly, lifecycle, and multi-instance behavior.
- Production table behavior keeps ordinary native text editing in cells and
  exposes one external contextual toolbar for explicit structure operations.
- Source formatting/minification remains Source-only. Preview remains an
  isolated sandbox and uses editor maximize rather than a duplicate fullscreen
  command.

The executable capability record is
[`wysiwyg-capability-matrix.md`](wysiwyg-capability-matrix.md). Known Critical
and High product defects in the executed Chromium qualification are zero.

## Passed gates

- lint, strict TypeScript, all unit suites, and documentation audit;
- 199/199 Chromium browser scenarios;
- 6/6 focused Chromium desktop/mobile CMS scenarios;
- direct axe WCAG A/AA WYSIWYG scan and existing UI accessibility corpus;
- integration performance and explicit-GC memory budgets;
- all 24 public package API reports and production builds;
- NodeNext, ESM, Vite, packed plugin, third-party widget, accessibility,
  security, teardown, tree-shaking, distribution, and release audits;
- MIT license metadata for all 24 packages;
- dependency audit with no known vulnerabilities.

The largest Playground-only chunk remains the lazily loaded Preview/CodeMirror
path at about 1.062 MB raw. The editor global is about 2.211 MB raw / 649.18 kB
gzip. These are recorded budgets, not regressions hidden as failures.

## External qualification blocker

The complete 12-run CMS matrix was attempted again on 2026-08-31:

- Chromium desktop/mobile: 6 passed;
- Firefox: browser launch failed before page creation because host
  `/lib64/libstdc++.so.6` lacks `GLIBCXX_3.4.26` required by
  `libmozsandbox.so`;
- WebKit: browser launch failed before page creation because the host lacks the
  reported GTK 4, Vulkan, Graphene, Event, Flite, AVIF, JPEG, and Manette
  runtime libraries.

These are environment blockers, not passing results and not observed SoEditor
failures. Publication should remain blocked until the same focused CMS journey
and the direct WYSIWYG selection/table corpus pass Firefox and WebKit/Safari on
a supported runner.

## Accepted non-P0 follow-up

- character-perfect cross-pane scroll synchronization remains an optional,
  disableable enhancement;
- advanced responsive image authoring remains broader than the verified core
  upload/selection/properties path;
- email optimization and simulated client rendering remain P1/P2 and are not
  email-client certification;
- collaboration, track changes, spreadsheet features, page building, and
  arbitrary executable HTML remain outside this release.
