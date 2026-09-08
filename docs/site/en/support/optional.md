---
title: 'Optional and compatibility features'
description: 'Understand optional video and preview features and the boundaries of historical compatibility packages.'
---

# Optional and compatibility features

The CMS product centers on WYSIWYG and optional Source. Video uses the explicit `/video` entry; article preview is configured through the optional entry. Enable these only when the host needs them.

Historical Markdown, review, comments, developer tools and Workspace framework hooks/composables remain separate compatibility capabilities. Default site demos do not load them. This page describes their status rather than expanding the product roadmap.

Existing consumers should follow their version’s public API and migration policy. [Repository documentation](https://github.com/sohophp/soeditor/tree/master/docs) contains internal architecture and historical material and may describe unreleased work.

## CMS framework integration

The new [React](/en/guide/react) and [Vue](/en/guide/vue) CMS components are thin adapters for ordinary website forms and keep Core framework-independent. They are available through separate entries in 1.3.0. Published video support has a [guide](/en/guide/video) and [runnable example](/en/examples/video).

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
