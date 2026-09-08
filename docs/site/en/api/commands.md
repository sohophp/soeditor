---
title: 'Commands'
description: 'Execute public editor commands with selection and availability checks.'
---

# Commands

Execute commands with `classic.editor.execute(id, ...args)` so changes use editing transactions. Check `commands.canExecute(id)` before running actions that depend on readonly or selection state.

Common commands include `editor.undo`, `media.browse`, `image.upload` and on-demand `document.format`. Each feature defines its arguments; do not concatenate arbitrary input into HTML.

Built-in controls preserve selection. Verify selection and focus in a real browser when implementing host controls.

## Checked code

<<< ../../examples/api.ts#commands

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
