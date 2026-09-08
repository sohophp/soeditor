---
title: 'Migration'
description: 'This site targets 1.2.1. Upgrade all explicitly installed @soeditor/* packages together, preserve representative HTML and keep a rollback build.'
---

# Migration

This site targets 1.2.1. Upgrade all explicitly installed `@soeditor/*` packages together, preserve representative HTML and keep a rollback build.

When moving from a broad historical entry, use `/cms` or `/cms/optional` and the CMS stylesheet. Verify Source loading on first activation, rather than checking only button visibility.

Version 1.2 adds optional video, article preview and toolbar drawers. Existing integrations need not enable them. Regress forms, saving, paste, tables, images and teardown after upgrading.

A narrower default entry does not remove historical APIs. Check the versioned public types for lower-level integrations.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
