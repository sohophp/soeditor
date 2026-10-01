---
title: 'Formatting on demand'
description: 'Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.'
---

# Formatting on demand

Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.

Formatting adjusts indentation and attribute layout while retaining original attribute quoting, entities, literal text, comments and embedded script/CSS data. Inline text boundaries, code blocks and explicitly preformatted whitespace remain intact. Minification removes structural indentation and redundant whitespace inside tags directly from the source, without reserializing tags or attributes. Both operations support undo. Automatic formatting requires explicit `source.autoFormat` configuration and is off by default.

## Checked code

<<< ../../examples/api.ts#formatting

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
