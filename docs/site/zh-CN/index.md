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
      details: 段落、列表、图片、视频和表格，覆盖日常 CMS 工作。
      link: /zh-CN/guide/toolbar
    - title: 按需 HTML Source
      details: 首次使用才加载，保留上下和左右分屏。
      link: /zh-CN/guide/source
    - title: 宿主拥有数据
      details: 对接表单、保存接口和可替换的资源选择器。
      link: /zh-CN/guide/forms
    - title: SoFinder 最佳搭档
      details: SoEditor 编辑内容，SoFinder 管理图片、视频和文件，一起完成 CMS 资源工作流。
      link: /zh-CN/guide/sofinder
---

<div class="home-install">

## 从一个 textarea 开始

```sh
pnpm add @soeditor/editor@1.4.0
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host) await createClassicEditor(host, { locale: 'zh-CN' });
```

1.4.0 默认开启[视频工具](/zh-CN/guide/video)，对话框与播放器按需加载；可用 `video: false` 关闭。也可通过独立的 [React](/zh-CN/guide/react) 和 [Vue](/zh-CN/guide/vue) 组件接入。

## SoEditor + SoFinder：最佳搭档

用 SoEditor 编写文章，用 [SoFinder](https://sofinder.sohophp.app/) 管理和选择资源。通过独立适配器连接资源库，让图片插入、文件链接和视频资源使用融入日常 CMS 编辑流程。

[访问 SoFinder 官网](https://sofinder.sohophp.app/) · [搭配说明与接入代码](/zh-CN/guide/sofinder) · [体验资源选择示例](/zh-CN/examples/assets)

</div>
