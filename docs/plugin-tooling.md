# Plugin package tooling and integration diagnostics

SoEditor 1.0 provides the public Node-only `@soeditor/plugin-tools` package.
Template version 3 targets the SoEditor 1.x public SDK and creates a strict ESM
package without overwriting an existing directory.

```bash
soeditor-plugin create ./product-card \
  --name @example/soeditor-product-card \
  --id example.product-card

soeditor-plugin create ./product-card \
  --name @example/soeditor-product-card \
  --id example.product-card \
  --kind cms-widget

soeditor-plugin check ./product-card
soeditor-plugin check ./product-card --packed
```

The selectable kinds are `basic`, `cms-widget`, `paste`, `upload`, and `theme`.
Generation is local and deterministic: it never downloads templates or loads a
catalog. The static check validates manifest/SemVer shape, ESM exports, the 1.x SDK peer
range, `sideEffects: false`, explicit root contribution export, stable and
unique plugin IDs, absence of SoEditor `src`/`dist`/`internal` and remote-code
imports, and common dynamic-evaluation/direct-DOM-HTML sinks. It does not import
or execute the plugin, prove that a package is trustworthy, or forbid a host
upload adapter from contacting its configured backend.

`--packed` additionally calls `npm pack --dry-run --ignore-scripts` and checks
that built JS, declarations, and package metadata are present while `src` is
absent. It does not execute package lifecycle scripts. It is still a local
package-shape check, not a malware scanner or registry trust decision.

## Workspace integration diagnostics

Attachment factories may explicitly declare:

- compatible `html`/`markdown` formats;
- required service tokens and human-readable labels;
- a requirement for an explicitly isolated Preview policy.

Workspace validates those requirements before calling `attach()`. Missing
services, incompatible formats, and unsafe Preview declarations produce frozen
diagnostics and fail mounting. Recovery recreation failures and crash-limit
termination use the same bounded diagnostic list. Diagnostics are available in
the Workspace snapshot and through optional `onDiagnostic`; there is no global
collector, remote catalog, or automatic telemetry.
