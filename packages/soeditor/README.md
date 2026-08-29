# @soeditor/editor

Convenience npm and browser distribution for SoEditor. Modern applications
should use the ESM entry and explicitly attach the editing/UI surfaces they
need. Direct browser builds expose the same public API through
`globalThis.SoEditor` without a global plugin registry.

```ts
import { SoEditor, minimalPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
```

The repository distribution guide contains visual-surface and direct-browser
examples. The 0.8 umbrella also exports the public comments and revisions
packages; applications still supply identity, permissions, persistence,
retention, and audit behavior.
