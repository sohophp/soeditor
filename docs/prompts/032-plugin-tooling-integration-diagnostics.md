# Phase 32 — Plugin Tooling and Integration Diagnostics

## Status

COMPLETE.

## Goal

Reduce extension setup failures with offline, versioned tools and explicit
per-workspace diagnostics.

## Required implementation

1. Add a private Node-only plugin scaffold/check package targeting the 0.9 SDK.
2. Validate manifests, peer ranges, exports, contribution IDs, unsupported
   internal imports, tree-shaking metadata, and packed artifacts without
   executing package scripts.
3. Add explicit attachment requirements for services, formats, and isolated
   Preview policy.
4. Diagnose recovery failures and crash-limit termination in bounded immutable
   Workspace snapshots.
5. Add unit, CLI, browser, documentation, and lifecycle verification.

## Explicitly deferred

- hosted marketplace, plugin discovery, remote source loading, signing service,
  telemetry, or a global plugin registry;
- public tooling/Workspace exports until Phase 33.
