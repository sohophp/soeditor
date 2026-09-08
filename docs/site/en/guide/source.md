---
title: 'Enable HTML Source'
description: 'Enable HTML Source through the optional CMS entry and load its runtime on first activation.'
---

# Enable HTML Source

Use `/cms/optional` with `editingModes: ['wysiwyg', 'source']`. Keep WYSIWYG as the initial mode. Source downloads and initializes when the user first enters Source or a Source split view.

Trigger `setWorkspaceView` from an explicit user action. Merely showing the Source button should not fetch its runtime. Await the switch before interacting with the new surface.

Repair invalid Source according to the displayed feedback; do not overwrite it from the visual DOM. [Try Source switching](/en/examples/source).

## Checked code

<<< ../../examples/api.ts#source

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
