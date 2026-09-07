# WYSIWYG completion and release decision

> 2026-09-07：当前工作区的优化状态、测量与验证统一见 [CMS 性能与稳定性优化](cms-optimization-2026-09-07.zh-CN.md)。以下日期更早的数字为历史记录；人工设备验收单独列出。

> 2026-09-05: WYSIWYG + Source local implementation and automated acceptance
> are complete; see [current evidence](wysiwyg-source-evidence.zh-CN.md).
> No publication or deployment was performed. Manual Safari and assistive-
> technology sign-off remain separate. Results below retain historical
> candidate context and must not replace the current evidence.

## Decision

On 2026-09-08 the repository owner explicitly authorized publishing the current
1.1.0 release. This supersedes the historical candidate publication hold below;
it does not convert missing manual qualification into passed evidence.

Current automated acceptance is recorded in
[the 2026-09-08 report](cms-followup-2026-09-08.zh-CN.md). Real Safari, OS IME,
Office clipboard, assistive technology and customer-material checks remain
unverified and must be stated as release limitations. Publication proceeds
through the protected npm workflow from the reviewed clean commit.

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
- 229/229 Chromium compatibility scenarios;
- 6/6 focused Chromium desktop/mobile CMS scenarios;
- 96/96 applicable Firefox/WebKit focused CMS and direct WYSIWYG scenarios in
  the matching official Playwright Linux image;
- direct axe WCAG A/AA WYSIWYG scan and existing UI accessibility corpus;
- integration performance and explicit-GC memory budgets;
- all 24 public package API reports and production builds;
- NodeNext, ESM, Vite, packed plugin, third-party widget, accessibility,
  security, teardown, tree-shaking, distribution, and release audits;
- MIT license metadata for all 24 packages;
- dependency audit with no known vulnerabilities.

The largest Playground-only chunk is the lazily loaded Source/CodeMirror path
at 576.69 kB raw. The CMS global is 486.67 kB raw / 149.97 kB gzip, while the
packed CMS Vite consumer is 445,611 bytes raw / 144,421 bytes gzip. These are
recorded measurements, not regressions hidden as failures.

## Cross-browser qualification

The complete 12-run CMS matrix was attempted again on 2026-08-31:

- Chromium desktop/mobile: 6 passed;
- Firefox: browser launch failed before page creation because host
  `/lib64/libstdc++.so.6` lacks `GLIBCXX_3.4.26` required by
  `libmozsandbox.so`;
- WebKit: browser launch failed before page creation because the host lacks the
  reported GTK 4, Vulkan, Graphene, Event, Flite, AVIF, JPEG, and Manette
  runtime libraries.

These remain environment blockers on the Rocky Linux workstation, not passing
results and not observed SoEditor failures. The current candidate reran the
focused CMS and complete direct WYSIWYG corpora in the matching official
Playwright Noble image: all 96 applicable Firefox/WebKit assertions passed.
Four cases are explicitly skipped because native clipboard permissions and CDP
IME injection are Chromium-only; cross-engine composition and synthetic
rich-paste paths still pass.

The repository now has an independent Firefox/WebKit CI job. An earlier
66-assertion version of that job and the full release gate passed for commit
`1fe622c8b17771daeabc256e0ea127e52d311c83` in Actions run `33460058428`.
Publication stays blocked until real Safari plus the documented manual
assistive-technology checks are completed.

## Accepted non-P0 follow-up

- character-perfect cross-pane scroll synchronization remains an optional,
  disableable enhancement;
- advanced responsive image authoring remains broader than the verified core
  upload/selection/properties path;
- email optimization and simulated client rendering remain P1/P2 and are not
  email-client certification;
- collaboration, track changes, spreadsheet features, page building, and
  arbitrary executable HTML remain outside this release.
