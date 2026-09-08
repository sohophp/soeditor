---
title: 'Troubleshooting'
description: 'Diagnose missing styles, Source loading, saving, duplicate toolbars and upload failures.'
---

# Troubleshooting

## Missing editor styles

Import `/cms/styles.css` and confirm the request returns CSS rather than a 404 HTML page.

## Source does not open

Use `/cms/optional`, enable editingModes and deploy every dynamic chunk. Preserve content, fix resource paths and retry.

## Saved content is missing

Read `getData()` or the synchronized textarea, not internal contenteditable DOM. Check the field name and server payload format.

## Duplicate toolbars after reopening

Retain instance handles and await destroy before removing hosts. Clean up partially failed initialization too.

## Upload failure

Distinguish client preflight, adapter rejection and server errors. The demo’s failure switch intentionally simulates an error.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
