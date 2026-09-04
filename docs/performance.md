# CMS performance budgets

## Status

Active and enforced performance policy for the CMS-only roadmap.

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

## Frozen distribution baseline

| Artifact                       |       Raw |      Gzip |    Enforced ceiling |
| ------------------------------ | --------: | --------: | ------------------: |
| packed `/cms` Vite startup JS  | 461.10 kB | 149.85 kB |        510 / 150 kB |
| optional Source/CodeMirror     |         — |         — | measured separately |
| CMS browser global             | 485.82 kB | 149.35 kB |        500 / 150 kB |
| CMS CSS                        |  26.19 kB |   4.80 kB |           27 kB raw |
| CMS ESM facade                 |   0.19 kB |   0.16 kB |            measured |
| lazy Classic implementation    |  84.78 kB |  24.18 kB |            measured |
| historical all-features global |  2,214 kB | 649.71 kB |            rejected |

The `/cms` artifact prebundles the narrow CMS runtime and keeps link, image and
table context tools in user-triggered chunks. Source, Preview and save adapters
are exposed only by `/cms/optional`; Source still loads `@soeditor/source` and
CodeMirror only when configured and remains external to the standalone global.

The nominal raw targets use rounded product units. The executable release gate
allows 510,000 bytes for the global and 27,250 bytes for CSS so normal toolchain
serialization variance remains bounded; gzip remains capped at 150,000 bytes.
The default CMS runtime preset omits host-owned file-manager/upload plugins and
non-visible code/list-property plugins. Applications requiring the file-manager
integration pass the full `cmsPreset` explicitly through the ESM CMS entry.

The packed-consumer gate reads the Vite manifest and counts the entry, the
immediately invoked Classic chunk and their static imports. Nested dynamic
Source imports are measured separately. Excluded feature markers are rejected
from the startup graph.

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

- The recorded CMS baseline is frozen; subsequent changes may not increase it
  without an owner-reviewed product justification.
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

The Node gate covers Core startup/teardown, canonical input, projection updates,
recovery, table operations, annotation mapping and retained memory. Browser
tests cover CMS interaction and lifecycle paths. Release verification enforces
the CMS artifact ceilings and rejects excluded product markers.

Release distribution remains checked by:

```bash
pnpm test:consumer
pnpm test:distribution
pnpm test:release
```

The release ceiling is 500 kB raw / 150 kB gzip for the CMS global and 27 kB raw
for CSS. The legacy 2.25 MB / 665 kB guard has been removed.

## Performance review checklist

For every runtime change record:

1. affected CMS journey;
2. modules added to default and optional graphs;
3. raw/gzip/CSS delta;
4. startup and interaction delta;
5. DOM/render/parse behavior changed;
6. resources created and cleanup proof;
7. focused and full verification commands.
