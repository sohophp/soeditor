# Phase 42 — Links and CMS Content Objects

## Status

COMPLETE.

## Goal

Make links and common CMS objects fully editable through reusable provider and
structured-object boundaries without executing remote embed HTML.

## Required implementation

1. Complete link create/edit/remove commands and UI for URL, title, target,
   rel, email, telephone, anchors, selected files, and host-provided internal
   content.
2. Add safe auto-link and configurable protocol/target-rel policy with
   deterministic serialization and deceptive-URL tests.
3. Add special-character insertion, named anchors, horizontal/page breaks,
   placeholders, and registered CMS structured objects.
4. Define optional provider services for internal-content selection and safe
   embed metadata; provider HTML/scripts must never enter the editor UI.
5. Cover selection, history, source preservation, readonly, provider failure,
   security, teardown, and packed third-party object/provider consumers.

## Explicitly deferred

- arbitrary remote scripts, untrusted iframe execution, oEmbed HTML injection,
  and universal provider support.

## Definition of Done

- every object mutation is command/transaction backed;
- URL and embed policy rejects executable/deceptive inputs deterministically;
- all repository gates pass with Critical = 0 and High = 0.

## Delivered

- Link create/inspect/edit/remove, email/telephone/web auto-linking, bounded
  per-instance protocol policy, deterministic target/rel normalization, and
  optional internal/file target selection.
- Configured atomic CMS object insert/update/remove commands, inert node views,
  named anchors, page breaks, placeholders, and special-character insertion.
- Metadata-only embed provider integration that ignores provider HTML and
  rejects unsafe input or returned URLs without canonical mutation.
- Unit, history, readonly, source-preservation, provider-failure, packed
  NodeNext, and 134-scenario Chromium evidence. Full release measurement is
  1,390.23 kB raw / 442.74 kB gzip with all other guards unchanged.
