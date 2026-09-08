---
title: 'Forms and reset'
description: 'Replace a named textarea and integrate native submission, FormData and form reset.'
---

# Forms and reset

The textarea `name` becomes the submitted field name. SoEditor synchronizes its value and refreshes canonical HTML before native submit. Reset restores the textarea default content.

For an Ajax form, call `preventDefault()` in the submit handler and read `FormData`. The demo displays that data without sending a request. Check required-field behavior in your actual form and validate fields on the server.

[Run the native form example](/en/examples/form).

## Runnable code

<<< ../../examples/form.ts

Shared `options` configures locale and change callbacks. `ctx.host` is a textarea with `name="content"`. The [native form example](/en/examples/form) includes the full host and shared code.

## Common errors

A field without `name` is absent from `FormData`. Mounting on an ordinary element does not create an implicit form field: copy `getData()` into a host field on submit. Reset uses the textarea default value, not the most recently saved result.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
