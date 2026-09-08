---
title: 'Events and state'
description: 'Observe canonical content changes, editor lifecycle and save state, and clean up host listeners.'
---

# Events and state

Observe canonical changes with the creation option `onChange`. It receives source, previousSource and origin. Persist source rather than parsing the view DOM.

`onReady`, `onFocus` and `onBlur` expose lifecycle notifications; `onError` handles errors. Read saving state separately through `save.onStateChange`. Dirty state is not the same as request failure.

Remove your own DOM listeners during host teardown. Editor destruction does not clean up arbitrary application code.

## Checked code

<<< ../../examples/api.ts#configuration

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
