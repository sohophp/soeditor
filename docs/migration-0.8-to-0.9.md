# Migrating from SoEditor 0.8 to 0.9

SoEditor `0.9.0` promotes the application-integration layer validated after the
0.8 review workflow. Upgrade every installed `@soeditor/*` package together;
mixing 0.8 and 0.9 package versions is unsupported.

## Newly public packages

Four package roots join the release set:

```bash
pnpm add @soeditor/workspace@0.9.0
pnpm add @soeditor/react@0.9.0 react@^19
pnpm add @soeditor/vue@0.9.0 vue@^3.5
pnpm add -D @soeditor/plugin-tools@0.9.0
```

`@soeditor/editor` also exports the framework-neutral Workspace contracts. It
does not export React, Vue, or Node-only plugin tooling, so applications only
install the framework/runtime packages they use.

## Workspace diagnostics

Existing Workspace configuration remains source-compatible. Snapshots now
include a bounded immutable `diagnostics` list. Attachment factories may add
explicit `requirements` for document formats, service tokens, or isolated
Preview. A mismatch fails before `attach()` and reports through optional
`onDiagnostic`.

```ts
const previewAttachment = {
    id: 'preview',
    requirements: { formats: ['html'], isolatedPreview: true },
    attach: ({ editor }) => attachPreview(editor),
};

await createEditorWorkspace({
    attachments: [previewAttachment],
    createEditor,
    onDiagnostic: (diagnostic) => reportIntegrationProblem(diagnostic),
    previewIsolation: 'isolated',
    value: { initialValue: source, kind: 'uncontrolled' },
});
```

React and Vue adapter options forward `onDiagnostic` and `previewIsolation`.
Continue to use `configurationKey` for deliberate React reconstruction and Vue
component keys for structural replacement; value and readonly changes do not
require remounting.

## Plugin packages

The Node-only `soeditor-plugin` command creates a strict 0.9 SDK package and
checks metadata/source without importing it. Build before packed inspection:

```bash
soeditor-plugin create ./my-plugin --name @example/my-plugin --id example.my-plugin
cd ./my-plugin
pnpm install
pnpm build
pnpm check
```

The checker is not a behavioral or security certification. Retain unit,
packed-consumer, browser, accessibility, and teardown tests appropriate to the
plugin.

## Verification checklist

- align every `@soeditor/*` dependency and peer range at 0.9;
- test controlled/uncontrolled ownership, recovery limits, diagnostic handling,
  and reverse teardown;
- verify React StrictMode and Error Boundary behavior or Vue mount/unmount and
  error callbacks;
- keep Preview explicitly sandboxed and keep CMS persistence based on
  `editor.getData()`, never projected DOM;
- run application accessibility, SSR-import, package, performance, and browser
  checks before deployment.
