# Phase 9 Implementation Specification — Preview Environment

## Status

Active implementation specification for Phase 9 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–8 implementation.

## Goal

Provide a realistic, isolated HTML preview mode without allowing preserved
source to execute in the editor application context.

## Package boundary

Create browser-facing `@soeditor/preview`, depending only on public Core APIs.
Core already models `preview` as an editor mode and must remain DOM-independent.
The preview package must not depend on an application framework or place preview
rendering in Core.

## Commands and service

`PreviewPlugin` registers:

```text
editor.preview
editor.preview.close
preview.refresh
```

Commands become available only when a preview engine is attached. Mode changes
flow through Core transactions. The attached engine exposes a narrow typed
refresh service and retained references become terminal after destruction.

## Preview engine

`createPreviewEngine` attaches one sandboxed iframe to an empty caller-owned
host. It must:

- show only in Preview mode;
- hide without destroying canonical content in other modes;
- refresh when canonical source changes;
- support explicit refresh;
- clean up idempotently and on Core editor destruction;
- reject duplicate attachment and non-empty hosts without data loss.

## Configuration

Support a validated immutable configuration for:

- a fragment template containing exactly one `{{ content }}` marker;
- escaped string context markers such as `{{ section }}`;
- inline preview CSS;
- stylesheet URLs;
- an optional base URL;
- iframe accessible title.

Complete HTML documents are previewed as their own document rather than nested
inside a fragment template. Configuration affects preview output only and never
rewrites canonical source.

## Security boundary

The iframe must have an empty sandbox token set: no scripts, same-origin,
forms, popups, downloads, or top navigation permissions. Generated preview
documents must prepend a fixed CSP that cannot be weakened by source/template
markup, remove refresh directives and source-controlled base elements, block
scripts/objects/frames/forms/connections, and allow only declared passive
resource categories. Use `no-referrer` for iframe resource requests.

Preservation is not execution. Scripts, event-handler attributes, unsafe embeds,
and unknown markup may remain in preview source while being unable to execute.

## UI integration

Add the existing UI package's registered `preview` toolbar item to the default
configuration. It toggles shared preview commands and remains disabled when no
preview engine is available.

## Tests

Cover normal, boundary, failure, and adversarial behavior:

- configuration validation, template context escaping, and immutability;
- mode commands, visibility, refresh, and external canonical changes;
- fragment templates, complete documents, CSS, and base URL behavior;
- custom elements/comments and semantic source survival;
- scripts/event handlers/meta refresh/nested frames cannot execute or escape;
- duplicate attachment, non-empty host, retained service, and cleanup paths;
- toolbar mode interaction and accessible iframe/status state;
- packed NodeNext/ESM consumption and clean public declarations;
- real Chromium iframe sandbox and rendering behavior.

## Documentation and ADR

Add an ADR for the sandbox/CSP/template trust boundary. Update architecture and
README for implemented behavior.

## Explicitly deferred

Do not add script-enabled preview, arbitrary sandbox customization, live
application JavaScript, server-side rendering, device emulation, split view,
Markdown preview, preview context functions, network interception, or a general
template language.

## Definition of Done

- preview is isolated from editor UI styles and execution context;
- configured templates/CSS render without mutating canonical HTML;
- content changes refresh safely;
- commands and UI use the shared mode/transaction path;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and browser tests pass.
