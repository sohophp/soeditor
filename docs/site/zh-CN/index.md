---
layout: home
title: 面向网站 CMS 的轻量 HTML 编辑器
description: 熟悉的可视化编辑，按需启用 Source，保留有意义的 CMS HTML。
hero:
    name: SoEditor
    text: 面向网站 CMS 的轻量 HTML 编辑器
    tagline: 写好内容，接好表单。WYSIWYG + HTML Source，为日常内容管理而设计。
    actions:
        - theme: brand
          text: 快速开始
          link: /zh-CN/guide/installation
        - theme: alt
          text: 在线体验
          link: /zh-CN/examples/basic
features:
    - title: 熟悉的编辑体验
      details: 段落、列表、图片和表格，覆盖日常 CMS 工作。
      link: /zh-CN/guide/toolbar
    - title: 按需 HTML Source
      details: 首次使用才加载，保留上下和左右分屏。
      link: /zh-CN/guide/source
    - title: 宿主拥有数据
      details: 对接表单、保存接口和可替换的资源选择器。
      link: /zh-CN/guide/forms
---

<div class="home-install">

## 从一个 textarea 开始

```sh
pnpm add @soeditor/editor@1.2.1
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host) await createClassicEditor(host, { locale: 'zh-CN' });
```

</div>
