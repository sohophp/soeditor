# ADR 0031: Thin framework lifecycle adapters

- Status: Accepted
- Date: 2026-08-30

## Context

Applications need idiomatic React and Vue lifecycle binding, but framework
ownership in Core or feature packages would undermine SSR imports, independent
instances, and non-framework consumers. React StrictMode also deliberately
replays Effects, while Vue DOM work must wait until mount.

## Decision

Add separate private `@soeditor/react` and `@soeditor/vue` packages whose only
SoEditor runtime dependency is `@soeditor/workspace`. React and Vue are peers
of their owning adapter only. The adapters translate framework lifecycle,
controlled values, and readonly updates into Workspace APIs; they do not choose
surfaces, discover DOM, register globals, or hide recovery policy.

React serializes Effect cleanup before replacement mounting and optionally
rethrows stored asynchronous failures during render for Error Boundaries. Vue
creates only from `onMounted()` and cleans from `onUnmounted()`. Both stay inert
during SSR.

## Consequences

- Core and every existing editor/feature package remain framework-independent;
- applications must stabilize structural configuration or change React's
  explicit `configurationKey` to request recreation;
- Suspense does not delay Workspace creation because attachments require
  committed refs;
- framework packages remain private until the 0.9 release gate.
