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

## Color picker

Text color, background color and highlighting share an inline spectrum: drag to adjust saturation and brightness, use the hue and opacity sliders, or enter HEX, RGB(A), HSL(A), or CSS color names. Choose HEXA (the default), RGBA or HSVA. Presets and recent colors remain available; the native system color dialog is removed. No Pickr dependency is required.

Dragging and typing update the preview only. Apply color, or press Enter in the color value field, to update the selected content in one undo step. Current color restores the value present when the menu opened. Cancel, Escape and outside clicks discard unapplied changes. Remove only clears the corresponding text, background or highlight color.

Use Left/Right for saturation, Up/Down for brightness, Shift for larger steps, and Home/End for the saturation bounds. Sliders retain native keyboard controls. Invalid values show an inline error without changing content or selection. The panel supports dark themes and narrow viewports; picker logic stays lazy until a color menu is first opened.

Available in 1.6.0. Manual screen reader and physical mobile device qualification remain separate.
