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
---

<div class="home-install">

## Start with a textarea

```sh
pnpm add @soeditor/editor@1.2.1
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host) await createClassicEditor(host, { locale: 'en' });
```

</div>
