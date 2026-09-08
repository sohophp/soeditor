---
title: '更新记录'
description: 'SoEditor 1.2.1 修复内容与文档对应的发布版本。'
---

# 更新记录

## 1.2.1

修复 1.2.0 发布包 `/cms` ESM 入口因属性压缩导致的初始化卡死，确保对象键在各分块之间一致。公开 API 不变。本站固定使用 1.2.1，普通示例使用 `/cms`，Source、保存和资源插件示例使用 `/cms/optional`。

新增浏览器回归直接导入构建后的 CMS 产物，验证初始 HTML、CMS 属性、注释、表格、替换和销毁。

## 1.2.0

增加显式可选的视频、文章预览、工具栏抽屉，以及选区、表格和图片编辑修复。该版本 `/cms` ESM 产物存在初始化缺陷，使用此入口前请升级到 1.2.1。

[升级指南](/zh-CN/support/migration) · [npm 发布包](https://www.npmjs.com/package/@soeditor/editor/v/1.2.1)。
