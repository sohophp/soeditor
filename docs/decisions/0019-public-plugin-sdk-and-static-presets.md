# ADR 0019: Public plugin SDK facade and static presets

- Status: Accepted
- Date: 2026-08-29

## Context

SoEditor already has working extension points across several owning packages,
but third-party authors must discover those APIs individually. Phase 13 also
requires presets without turning them into editor singletons or hiding surface
attachment and security configuration.

## Decision

Add `@soeditor/plugin-sdk` as a narrow facade over intentionally public,
SoEditor-owned extension contracts. Ownership stays with the original package;
the facade does not create another registry or lifecycle. Third-party library
types and internal package subpaths remain excluded.

Add `@soeditor/presets` as immutable data: format, plugin constructors, and UI
toolbar configuration. Presets do not instantiate an editor or browser surface.
A validated composition helper returns a new frozen preset and rejects duplicate
plugin IDs.

Continue using explicit plugin lifecycle methods for contribution registration.
Add only contribution kinds demonstrated by current features. New declarative
manifest, menu, and formatter systems require future concrete use cases.

## Consequences

Plugin authors gain one documented import surface while advanced consumers may
continue importing owning packages directly. Presets provide coherent defaults
without introducing global state, implicit DOM ownership, FileManager coupling,
or hidden Preview security policy.

The SDK has peer dependencies on its owning SoEditor packages and must remain a
small externalized ESM facade. Changes to a re-exported contract remain changes
to the original public API and require the same compatibility discipline.
