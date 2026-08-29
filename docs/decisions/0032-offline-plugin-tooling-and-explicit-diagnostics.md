# ADR 0032: Offline plugin tooling and explicit integration diagnostics

- Status: Accepted
- Date: 2026-08-30

## Context

Third-party plugin failures commonly come from package metadata, unsupported
imports, duplicate identities, missing services, incompatible formats, and
incorrect Preview assumptions. A remote marketplace or runtime source loading
would add trust and availability risks without solving these local contracts.

## Decision

Provide a versioned offline SDK template and a static package checker. The
checker never imports plugin source; packed inspection disables lifecycle
scripts. Workspace attachment requirements are explicit data validated before
mounting, and failures become bounded per-instance diagnostics.

## Consequences

- plugin setup errors become deterministic and CI-checkable;
- plugins and applications retain explicit service, format, and Preview-policy
  ownership;
- static checks cannot prove plugin behavior or safety, so packed consumer and
  browser tests remain necessary;
- no hosted catalog, remote code loading, telemetry, or mutable global registry
  is introduced.
