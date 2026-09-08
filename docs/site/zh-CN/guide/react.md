---
title: 'React 接入'
description: '绑定 CMS HTML、管理生命周期和按需启用 Source。'
---

# React 接入

::: warning 版本说明
`/cms` 框架组件属于当前工作区的新增 API，尚未随 npm 1.2.1 发布。不要把下面的组件导入用于已发布的 1.2.1 适配包。旧的 `useSoEditorWorkspace` 入口继续兼容。
:::

## 本地运行

在 SoEditor 仓库根目录执行：

```sh
pnpm install
pnpm --filter @soeditor/editor... --filter @soeditor/react --filter @soeditor/vue build
DOCS_WORKSPACE_PREVIEW=1 pnpm docs:dev --host 0.0.0.0
```

打开终端显示的地址，进入本页后点击“开始体验”。此模式使用工作区组件和编辑器，标记为不索引的本地预览；正式构建仍使用发布包，部署检查会拒绝工作区预览产物。框架源码直接来自下面列出的仓库文件，不包含在 1.2.1 发布示例下载包中。

## 绑定文章 HTML

```tsx
'use client';
import { useState } from 'react';
import { SoEditor } from '@soeditor/react/cms';
import '@soeditor/editor/cms/styles.css';

export function ArticleField() {
    const [html, setHtml] = useState('<p>Article</p>');
    return (
        <SoEditor
            name="body"
            value={html}
            onChange={setHtml}
            options={{ locale: 'zh-CN', ariaLabel: '文章正文' }}
            onError={console.error}
        />
    );
}
```

## 行为约定

- React 使用 `value` / `onChange(html, change)`，Vue 使用 `v-model`，并发出 `change(html, change)`。将编辑结果写回绑定状态；外部值变化不会再次触发 change，也不会重建编辑器。
- 不需要受控值时传入 `defaultValue`（Vue 模板用 `default-value`）；初始绑定值或默认值是本次挂载的表单重置基线。
- `name` 用于原生提交和 `FormData`；`readonly` 可动态切换。SSR 输出转义且只读的 textarea，客户端挂载后才创建编辑器。
- 工具栏、语言、插件、`options` 和 `createEditor` 在创建时读取；修改结构配置时改变组件 `key`。普通父组件渲染保留选区和撤销历史。
- React 用 `onReady` / `onFocus` / `onBlur` / `onError`；Vue 用 `@ready` / `@focus` / `@blur` / `@error`。ready 提供 Classic 实例，可调用 `focus()`、`getData()`、`setWorkspaceView()`。
- 生命周期由组件管理，不要自行调用实例的 `destroy()`。异步初始化结束前卸载也会清理实例；失败后显示宿主错误提示，改变 `key` 可重新创建。

## Source 与加载

默认导入只加载 CMS WYSIWYG。启用 Source 时传入显式 `createEditor` 工厂，并配置 `editingModes: ['wysiwyg', 'source']`。Source 在第一次切换时加载，格式化仍独立按需加载。

<<< ../../examples/frameworks/shared.ts

## 排错与版本范围

样式缺失时确认导入了 CMS CSS。找不到 `/cms` 时先核对版本：1.2.1 适配包没有这个新增入口。不要通过 `v-html` 或 `dangerouslySetInnerHTML` 渲染编辑内容，也不要在 render/setup 中创建实例。

声明的 peer 范围为 React 18.2–19、Vue 3.5；本轮自动化使用 React 19.2.8、Vue 3.5.42。SSR 支持不等于对全部 Next/Nuxt 版本的认证。

[运行完整表单示例](/zh-CN/examples/react)
