---
title: '安装与接入'
description: '安装固定版本，然后引入 CMS 入口和样式。把下面的 textarea 放进宿主页面，在 DOM 就绪后挂载。'
---

# 安装与接入

安装固定版本，然后引入 CMS 入口和样式。把下面的 textarea 放进宿主页面，在 DOM 就绪后挂载。

```sh
pnpm add @soeditor/editor@1.2.1
```

```html
<label for="content">文章内容</label>
<textarea id="content" name="content"><p>开始编辑</p></textarea>
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';
```

下面的挂载函数是经过类型检查的运行代码。调用 `await attach()` 获取实例。默认入口提供 WYSIWYG；需要源码或保存适配器时使用可选入口。

## 可运行代码

<<< ../../examples/api.ts#installation

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
