# Phase 12 Implementation Specification — File Manager and SoFinder

## Status

Active implementation specification for Phase 12 of `docs/ROADMAP.md`.

## Goal

Allow image insertion to consume a replaceable file-selection capability and
provide a SoFinder adapter without coupling Core, Rich Text, or SoEditor UI to
SoFinder implementation details.

## Generic capability

Create `@soeditor/file-manager` with SoEditor-owned immutable request/result
types, a typed service token, runtime result validation, and a plugin that adds
an `image.browse` command plus optional toolbar contribution. The integration
plugin depends on the existing Image command instead of changing ImagePlugin or
bypassing its controlled transaction path.

The first request is intentionally singular and image-focused while retaining a
generic `kind` field for later file/media consumers. Cancellation returns null.
Reject malformed dimensions, empty/control-character URLs, and executable URL
schemes before invoking `image.insert`.

## SoFinder adapter

Create `@soeditor/adapter-sofinder`. No stable SoFinder SDK is present in this
repository, so define a narrow injected `SoFinderPicker` boundary rather than
inventing a hard package dependency or private global API. Map its selection
value to the generic FileManager result and preserve optional metadata through
validated SoEditor values.

The consuming application owns SoFinder loading, authentication, dialog/window
security, and picker lifecycle. The adapter owns only contract translation.

## Lifecycle and concurrency

Only one picker request may be active per editor plugin. While a request is
pending, the command is unavailable. Results arriving after plugin/editor
destruction must not mutate state. Adapter failures remain observable.

## Playground and tests

Provide custom-manager and SoFinder-adapter routes in the browser harness. Cover
success, cancellation, malformed/untrusted results, URL schemes, dimensions,
concurrent requests, readonly/unavailable commands, destruction, adapter
mapping, package isolation, packed consumers, and real Chromium insertion.

## Security boundary

File managers are application-provided capabilities, not sanitizers. Selection
results are untrusted at the package boundary and receive structural validation
plus a conservative executable-scheme denylist. Image insertion still uses the
existing inert visual model and controlled command/transaction path. Preview
network policy remains independent.

## Explicitly deferred

Do not implement uploads, file deletion/rename, authentication, a SoFinder UI,
an iframe/postMessage protocol without an authoritative SoFinder contract,
multi-selection, galleries, video/audio insertion, cropping, or asset storage.

## Definition of Done

- Image insertion works with a simple custom FileManager;
- the same Image plugin works through SoFinderAdapter;
- no SoFinder dependency enters Core, Rich Text, or generic UI;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and Chromium pass.
