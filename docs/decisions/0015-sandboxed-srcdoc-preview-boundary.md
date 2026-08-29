# ADR 0015: Sandboxed srcdoc preview boundary

- Status: Accepted
- Date: 2026-08-29

## Context

Preview must render realistic application HTML, CSS, and templates while
SoEditor preserves source that may include scripts, event handlers, embeds, and
other executable browser features. Rendering that source in the editor document
would conflate preservation with execution and expose the host application.

## Decision

`@soeditor/preview` renders into a package-owned `iframe.srcdoc`. The iframe has
an empty `sandbox` token set and `no-referrer`, so it receives no script,
same-origin, form, popup, download, or top-navigation capability.

Before assigning `srcdoc`, the renderer parses a preview-only document, removes
source/template CSP and refresh directives plus source-controlled base elements,
and prepends a fixed CSP. The policy blocks scripts, connections, frames,
objects, forms, and navigation while allowing passive HTTP(S), data, and blob
styles/media resources required by preview. A validated application base URL
may be inserted explicitly.

Fragment templates are trusted application configuration and contain exactly
one raw `{{ content }}` slot. Context values are escaped strings. Complete HTML
documents are treated as their own preview document. DOM parsing and
normalization happen only in `srcdoc`; canonical editor source is never replaced
by preview output.

Preview mode and refresh are command-driven. One attached engine owns its iframe
and per-editor service lifecycle.

## Consequences

Preserved executable markup can be visually inspected without executing in the
editor or acquiring the editor origin. Preview CSS is isolated from editor UI
CSS, and preview document navigation cannot control the parent.

The initial preview cannot run site JavaScript or faithfully demonstrate
script-dependent widgets. It permits passive network resources declared by the
document/application and therefore is not an offline or privacy-isolated
renderer. Script-enabled preview would require a separate future security ADR.
