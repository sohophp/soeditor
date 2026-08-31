# @soeditor/plugin-tools

Public 1.0 offline plugin scaffolding and package audit tools.

```bash
soeditor-plugin create ./my-plugin --name @example/my-plugin --id example.my-plugin
soeditor-plugin create ./product-card --name @example/product-card --id example.product-card --kind cms-widget
soeditor-plugin create ./paste --name @example/paste --id example.paste --kind paste
soeditor-plugin create ./upload --name @example/upload --id example.upload --kind upload
soeditor-plugin create ./theme --name @example/theme --id example.theme --kind theme
soeditor-plugin check ./my-plugin --packed
```

Template version 3 creates deterministic `basic`, `cms-widget`, `paste`,
`upload`, and `theme` contribution families. The checker reads source and
metadata without importing plugin code, and rejects internal/remote imports,
dynamic evaluation, and direct DOM HTML injection sinks. Packed inspection
uses `npm pack --dry-run --ignore-scripts`.

See [`docs/plugin-tooling.md`](../../docs/plugin-tooling.md).
