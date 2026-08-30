# Plugin package tooling and integration diagnostics

SoEditor 1.0 provides the public Node-only `@soeditor/plugin-tools` package.
Template version 2 targets the SoEditor 1.0 public SDK and creates a strict ESM
package without overwriting an existing directory.

```bash
soeditor-plugin create ./product-card \
  --name @example/soeditor-product-card \
  --id example.product-card

soeditor-plugin check ./product-card
soeditor-plugin check ./product-card --packed
```

The static check validates manifest/SemVer shape, ESM exports, the 1.x SDK peer
range, `sideEffects: false`, explicit root contribution export, stable and
unique plugin IDs, and absence of SoEditor `src`/`dist`/`internal` imports. It
does not import or execute the plugin.

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
