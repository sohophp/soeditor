---
title: 'Mounting and lifecycle'
description: 'Mount on a textarea or element, retain the editor handle and destroy it before removing the host.'
---

# Mounting and lifecycle

`createClassicEditor(host, options)` accepts a textarea or HTMLElement and returns a Promise. Await creation before using the handle. A textarea integrates with native forms; an element host needs application-owned persistence.

Do not mount twice on the same host. Await `destroy()` before removing a dynamic field or modal. Use `setData()` for stored HTML and `getData()` for canonical content, rather than reading the authoring DOM.

## Checked code

<<< ../../examples/api.ts#lifecycle

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
