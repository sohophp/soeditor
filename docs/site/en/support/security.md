---
title: 'HTML and security'
description: 'Preserve meaningful CMS HTML without granting execution, and enforce security at the host boundary.'
---

# HTML and security

HTML is the canonical persistence format. Preserve meaningful elements, attributes, classes, comments and CMS markers. Preservation, visual support and execution permission are separate concerns.

The authoring surface keeps scripts, event handlers and unsafe embeds inert. That does not make the output safe to execute in every frontend context. Apply server-side processing for the eventual rendering context.

The host owns authentication, authorization and request protection for upload and save endpoints. Site demos have no production backend and collect no editing content.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
