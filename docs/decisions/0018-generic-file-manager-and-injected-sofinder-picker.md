# ADR 0018: Generic FileManager and injected SoFinder picker

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 12 must prove that Image insertion can use SoFinder or another manager
without changing ImagePlugin. SoFinder is a separate product and this repository
contains no authoritative SDK, browser-global, iframe, or message protocol that
SoEditor can safely bind to.

## Decision

`@soeditor/file-manager` owns a small async FileManager capability and token.
Its integration plugin adds `image.browse`, validates selection results, and
delegates insertion to the existing `image.insert` command. ImagePlugin remains
unaware of file managers.

`@soeditor/adapter-sofinder` accepts an injected `SoFinderPicker` function with
SoEditor-documented request and selection values. The host application is
responsible for adapting its actual SoFinder version/UI to that function. The
adapter contains no SoFinder runtime dependency and maps the picker result to
the generic FileManager contract.

Selected URLs remain source data, but the integration rejects empty/control
character values and executable schemes before insertion. It validates finite
positive integer dimensions and immutable plain metadata. This is boundary
validation, not a claim that remote resources are trusted or sanitized.

## Consequences

Custom managers and future adapters share the same Image command flow. A change
to SoFinder's private UI or transport does not force changes in Core or
ImagePlugin.

Applications must provide the small picker bridge for their SoFinder release.
An official SoFinder SDK adapter may replace that bridge later through a new or
superseding ADR once an authoritative contract exists.
