# @soeditor/plugin-tools

Public 1.0 offline plugin scaffolding and package audit tools.

```bash
soeditor-plugin create ./my-plugin --name @example/my-plugin --id example.my-plugin
soeditor-plugin check ./my-plugin --packed
```

The checker reads source and metadata without importing plugin code. Packed
inspection uses `npm pack --dry-run --ignore-scripts`.

See [`docs/plugin-tooling.md`](../../docs/plugin-tooling.md).
