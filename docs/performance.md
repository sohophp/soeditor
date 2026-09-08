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

## Optional video measurement (2026-09-08)

The optional video journey uses inert cards and loads properties/preview only
on demand. Canonical clipboard handling and card selection stay in the optional
plugin. Classic dialog move/resize controls now load on first dialog creation;
the base dialog remains usable if that enhancement cannot load. Toolbar drawers
share their mounting and cleanup implementation with the compatibility menu.

`pnpm test:loading` passed the unchanged budgets: the optional Classic initial
script was 510,918 bytes raw / 151,821 gzip; the CMS global was 483,993 raw /
149,632 gzip, with 24,935 bytes of CSS. No video runtime, recovery asset, or dialog
window runtime was requested at startup in the production video fixture.

`node scripts/measure-cms-video.mjs` verified recovery after an aborted runtime
request and rendered 150 video cards (11,250 HTML characters) in 39.8 ms. The
13 real typing samples measured 3.8 ms median / 14.1 ms maximum from `beforeinput`
to the next animation frame. Startup samples were 54.8 ms without the plugin
and 43.9 ms with it; this single local run does not establish a speedup or a
cross-device latency guarantee.

Raw reports: [video interaction/loading](evidence/cms-video-current.json) and
[CMS budget and Source recovery audit](evidence/cms-video-loading-current.json).
Browser tests exercise real native WebM playback; YouTube tests use a controlled
player response and do not certify external platform playback.

## YouTube metadata follow-up (2026-09-08)

URL enrichment stays inside the already lazy video properties runtime. Its
production gzip size grew from 5,425 to 6,476 bytes; the independent recovery
asset grew from 15,392 to 16,402 bytes. The optional Classic initial script
remained exactly 510,918 raw / 151,821 gzip bytes, and the unchanged loading
budgets passed. Input is debounced by 350 ms, each request has a five-second
timeout, and URL changes/dialog teardown cancel pending work.

The browser fetched a real YouTube title and thumbnail from the localhost demo.
All 413 unit tests and 33 focused Chromium/Firefox/WebKit video scenarios passed,
including manual-edit protection, stale responses, failed requests, and teardown.
Type, lint, API, documentation, build and production recovery checks passed.
See the [metadata and loading evidence](evidence/youtube-metadata-current.json).

## YouTube preview recovery (2026-09-08)

A live preview reproduced an embedded-player connection failure with no useful
editor feedback. Video-properties preview now includes a loading reminder,
reload and direct watch actions, a wider landscape viewport, and height-bounded
portrait layout. Cross-origin iframe load is deliberately not considered proof
of playback. A fresh iframe is created on reload; close removes it and clears
the pending reminder without modifying article HTML.

All 33 focused video scenarios passed across Chromium, Firefox and WebKit,
including an aborted player request followed by a successful reload, minimum
player size and portrait fitting. A real YouTube player was then clicked in the
localhost demo: its video advanced to 1.49 seconds with `paused=false`,
`readyState=4`, and no media error. This verifies that sample in this environment,
not every video's embedding permissions or every deployment network.
See [preview playback and production-loading evidence](evidence/youtube-preview-current.json).

## Performance review checklist

For every runtime change record:

1. affected CMS journey;
2. modules added to default and optional graphs;
3. raw/gzip/CSS delta;
4. startup and interaction delta;
5. DOM/render/parse behavior changed;
6. resources created and cleanup proof;
7. focused and full verification commands.

### Whole-article video preview (2026-09-08)

Classic popup preview mounts approved YouTube players outside the script-disabled
article iframe. Layout updates are coalesced with animation frames; a scroll-offset
sampler handles WebKit's suppressed child scroll callbacks without measuring
layout on unchanged frames. All observers, players and scheduled work are released
on refresh or popup teardown. The media service is an explicit optional entry;
normal CMS startup remains within the frozen loading budgets.

[Current evidence](./evidence/article-video-preview-current.json) records successful
live Chromium playback (`currentTime > 5`, `paused: false`, `readyState: 4`, no media
error) and the production loading checks. The trusted empty popup shell inherits
the caller URL so the player receives a real origin referrer; article content is
assigned only to sandboxed `srcdoc`. This addresses YouTube's
[153 client-identification error](https://developers.google.com/youtube/iframe_api_reference#onError).
Live network playback is distinct from deterministic browser tests and does not
certify every video, network environment or browser.

### Video preview follow-up (2026-09-08)

[The production-built 100-video fixture](./evidence/video-preview-followup-current.json)
loads one YouTube player initially, keeps that same player through twelve text
updates without another player request, and loads one additional player on a jump
to the end of the article. Measured popup activation was 876 ms; text-preview
refresh P95 was 226 ms; scrolling to and loading the final mock player took
614 ms. These are end-to-end automation timings with deterministic player HTML,
not network playback latency or input-to-frame latency. Reproduce with
`node scripts/measure-video-preview.mjs /tmp/video-preview-measurement.json`.

[Production loading and recovery evidence](./evidence/video-preview-followup-loading.json)
records passing frozen CMS budgets, optional properties/recovery isolation and
150-card typing measurements. The default global remains 483,993 raw / 149,632
gzip bytes; standalone CSS remains 24,935 bytes. Shared preview recovery controls
load only with the optional video preview/properties path.

Players are retained by unchanged media HTML and occurrence order. Hidden and
collapsed media do not load; scrolling is coalesced, including WebKit's iframe
scroll chaining. A clipped playback layer lets article links and disclosures
receive pointer input outside video bounds. Updating a template or text replaces
the inert article document while keeping matching players attached. No playback
coordinates, placeholder metadata or recovery UI are written into saved HTML.

Validation includes 413 unit tests, production build, typecheck, lint, API and
packed NodeNext/Vite consumers. The full Chromium product run passed 161 of 162
cases; the existing configurable-toolbar drawer keyboard selection case failed
intermittently (two of three isolated repetitions passed). That UI implementation
was not changed by this video follow-up. This is a remaining general regression
qualification issue, separate from the focused video evidence.

Focused video verification passed 17 Chromium cases and 34 Firefox/WebKit cases;
the desktop/mobile CMS suite passed 16 cases. [Live Chromium playback evidence](./evidence/video-preview-followup-live.json)
shows the same YouTube player remaining attached and playing while article text
changed: playback advanced from 3.157 to 6.263 seconds, with ready state 4 and no
media error. Live playback does not certify every external video or network.

### 1.2.0 release follow-up

The earlier intermittent drawer selection failure is fixed by synchronous capture
on editing focusout. Twelve same-task selection/focus repetitions passed. The
release qualification record supersedes that earlier unresolved status; see
[1.2.0 release preparation](releases/1.2.0.md).
