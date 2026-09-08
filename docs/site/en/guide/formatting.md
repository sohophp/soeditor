---
title: 'Formatting on demand'
description: 'Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.'
---

# Formatting on demand

Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.

Formatting can change whitespace and serialization without removing meaningful CMS HTML. Inspect the result and use undo when needed. Automatic formatting requires explicit `source.autoFormat` configuration and is off by default.

## Checked code

<<< ../../examples/api.ts#formatting

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
