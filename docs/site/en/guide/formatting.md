---
title: 'Formatting on demand'
description: 'Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.'
---

# Formatting on demand

Formatting is a separate enhancement. Opening Source should not fetch Prettier; invoking the formatting command loads the required tools.

Formatting adjusts indentation and attribute layout while retaining original attribute quoting, entities, literal text, comments and embedded script/CSS data. Inline text boundaries, code blocks and explicitly preformatted whitespace remain intact. Minification removes structural indentation and redundant whitespace inside tags directly from the source, without reserializing tags or attributes. Both operations support undo. Automatic formatting requires explicit `source.autoFormat` configuration and is off by default.

## 1.5.0: error positions and source protection

When HTML cannot be parsed, formatting and minification report the first reason, a one-based line and column, and a stable error code while retaining the original source. Failure adds no undo entry. The worker and CSP-constrained main-thread fallback use the same diagnostics in English, Simplified Chinese and Traditional Chinese.

An unclosed tag may be detected only at the end of the document; the position is where the parser found the problem. Valid `<style>` and inline `style` content remain intact. Formatting neither validates CSS nor deletes styles or repairs tags automatically.

## Checked code

<<< ../../examples/api.ts#formatting

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
