---
layout: home
title: HTML editing for your CMS
description: Familiar visual editing, on-demand Source, and meaningful CMS HTML preservation.
hero:
    name: SoEditor
    text: HTML editing for your CMS
    tagline: Write content. Connect your forms. WYSIWYG + HTML Source for everyday publishing.
    actions:
        - theme: brand
          text: Get started
          link: /en/guide/installation
        - theme: alt
          text: Explore examples
          link: /en/examples/basic
features:
    - title: Familiar authoring
      details: Paragraphs, lists, images and tables for daily CMS work.
      link: /en/guide/toolbar
    - title: Source on demand
      details: Loads on first use, with stacked and side-by-side views.
      link: /en/guide/source
    - title: Your host owns the data
      details: Connect forms, save endpoints and replaceable asset pickers.
      link: /en/guide/forms
    - title: SoFinder — our best companion
      details: Edit content with SoEditor and manage images, videos and files with SoFinder.
      link: /en/guide/sofinder
---

<div class="home-install">

## Start with a textarea

```sh
pnpm add @soeditor/editor@1.3.0
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host) await createClassicEditor(host, { locale: 'en' });
```

## SoEditor + SoFinder: our best companion for CMS authoring

Write articles with SoEditor and manage assets with [SoFinder](https://sofinder.sohophp.app/). Connect your asset library through the separate adapter for image insertion, file links and video resource workflows.

[Visit SoFinder](https://sofinder.sohophp.app/) · [Integration guide and code](/en/guide/sofinder) · [Try the asset picker example](/en/examples/assets)

</div>
