---
title: 'Instance methods'
description: 'The ClassicEditor returned by createClassicEditor() is the main CMS application handle.'
---

# Instance methods

The ClassicEditor returned by `createClassicEditor()` is the main CMS application handle.

| Method                 | Result and behavior                    |
| ---------------------- | -------------------------------------- |
| getData()              | Canonical HTML string                  |
| setData(source)        | Replace canonical content              |
| focus()                | Focus the editing surface              |
| setReadonly(value)     | Change readonly state                  |
| setWorkspaceView(view) | void or Promise; consistently await it |
| save() / retrySave()   | Promise; requires a save adapter       |
| destroy()              | Promise; release owned resources       |

Do not use a destroyed handle. Access commands and services through the public `classic.editor` interface rather than private fields.

## Checked code

<<< ../../examples/api.ts#lifecycle

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
