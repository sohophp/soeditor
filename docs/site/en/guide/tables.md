---
title: 'Tables'
description: 'Create content tables, edit rows and cells, and preserve meaningful HTML with undo support.'
---

# Tables

Create content tables with the table tool. Select cells to insert or delete rows and columns, merge or split cells, and edit table or cell properties with undo support.

Use headers to express row and column relationships, and captions where helpful. Tables represent structured content rather than page layout.

Check scrolling, keyboard navigation and contextual controls on narrow screens. Legacy CMS attributes such as cellpadding, widths and classes must remain meaningful after saving.

## Minimal content and expected behavior

<<< ../../examples/api.ts#table

Click a cell to use contextual tools. After changing rows, columns or properties, read `getData()`. Expect semantic HTML without editor handles or selection styles.

## Common errors

Do not mutate cells in the projection DOM. Host CSS determines the rendered saved result; `cellpadding`, `border-collapse` and padding rules can jointly affect spacing.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
