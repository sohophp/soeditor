# ADR 0021: Scoped umbrella package identity

- Status: Accepted
- Date: 2026-08-29
- Amends: ADR 0020 npm package identity

## Context

ADR 0020 selected an unscoped `soeditor` umbrella package for convenient ESM
and CDN consumption. During the protected initial publication, npm rejected
that unpublished name because its package-name similarity policy considers it
too similar to the existing `jsoneditor` package. Registry availability checks
cannot predict this server-side creation policy, and rotating credentials does
not change the result.

The `@soeditor` organization and the other public feature packages already
exist. The owner explicitly approved `@soeditor/editor` as the replacement npm
identity. The source directory remains `packages/soeditor`; its name reflects
the product and build projection rather than the public registry namespace.

## Decision

Publish the umbrella as `@soeditor/editor`. ESM consumers import the package and
its explicit stylesheet subpath as follows:

```ts
import { SoEditor, minimalPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';
```

Keep the `SoEditor` browser global, `soeditor.global.js`, `soeditor.css`, public
exports, modular dependencies, and framework-independent runtime behavior from
ADR 0020 unchanged. Version-pinned CDN URLs use the scoped npm path.

Release automation publishes `@soeditor/editor` before the other packages so
the umbrella identity and credential fail closed before a multi-package write.

## Consequences

All 15 supported packages share the `@soeditor` namespace, and npm installation
requires the scoped name. Existing documentation and consumer fixtures must not
advertise the rejected unscoped import. The internal directory name and browser
brand remain stable, avoiding a source-layout migration that would provide no
public API benefit.

The unscoped `soeditor` name is not part of the supported 0.5.x distribution.
If npm later permits that name, adding an alias would require a separate owner
decision and release review; it must not silently replace `@soeditor/editor`.
