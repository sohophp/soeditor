# ADR 0033: Public 0.9 integration boundary

- Status: Accepted
- Date: 2026-08-30

## Context

Workspace, React/Vue adapters, and offline plugin tooling were intentionally
validated as private packages in Phases 30–32. The 0.9 release must make those
integration paths installable without making frameworks or Node tooling part
of the editor runtime.

## Decision

Publish four additional package roots. Export Workspace from
`@soeditor/editor`; keep React, Vue, and plugin tooling separate. React/Vue use
framework peers, plugin tooling is Node-only, and Core remains unaware of all
four. Align and audit a 23-package 0.9 release set and require measured
integration and packed-consumer gates.

## Consequences

- framework-neutral applications can use Workspace directly or through the
  umbrella;
- framework users opt into exactly one adapter and its peer runtime;
- browser consumers do not receive Node-only plugin tooling transitively;
- 0.9 remains a pre-1.0 SemVer line; final API freezing belongs to Phase 34;
- publication, tags, hosted releases, and CDN verification remain explicit
  owner-controlled operations.
