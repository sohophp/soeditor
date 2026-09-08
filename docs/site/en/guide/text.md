---
title: 'Text and lists'
description: 'Format paragraphs, headings, inline text and lists while preserving meaningful CMS HTML.'
---

# Text and lists

Select text for inline formatting such as bold, italic and links. Paragraphs, headings, quotes and lists operate on blocks. Alignment and indentation use commands and participate in undo history.

`code` is inline semantics; `pre` preserves whitespace and line breaks. Avoid using headings only for appearance or repeated spaces for indentation.

Existing classes, attributes and CMS markers should survive editing. Check the HTML against your host stylesheet after changing block types.

## Minimal content and expected behavior

<<< ../../examples/api.ts#content

Select text to toggle bold, or place the caret in a list item to change its list style. Undo restores the previous state; read `getData()` to inspect the HTML.

## Common errors

Commands enable or disable according to selection. External buttons should restore editor focus before executing public commands. Do not reconstruct persisted content from the DOM.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
