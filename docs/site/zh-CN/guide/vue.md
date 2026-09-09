---
title: 'Vue 接入'
description: '绑定 CMS HTML、管理生命周期和按需启用 Source。'
---

# Vue 接入

## 安装与运行

`/cms` 组件从 1.3.0 起正式发布，本站示例引用 1.4.0；原有 `useSoEditorWorkspace` 入口继续兼容。

```sh
pnpm add @soeditor/editor@1.4.0 @soeditor/vue@1.4.0 vue
```

点击示例的“开始体验”运行已发布的软件包。[下载完整示例源码](/downloads/soeditor-examples-1.4.0.tar.gz)，解压后执行 `pnpm install` 和 `pnpm dev`，打开 `vue.html`。

## 绑定文章 HTML

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SoEditor } from '@soeditor/vue/cms';
import '@soeditor/editor/cms/styles.css';
const html = ref('<p>Article</p>');
</script>

<template>
    <SoEditor
        v-model="html"
        name="body"
        :options="{ locale: 'zh-CN', ariaLabel: '文章正文' }"
        @error="console.error"
    />
</template>
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

样式缺失时确认导入了 CMS CSS。找不到 `/cms` 时先核对版本：请安装 1.4.0 或更新版本，1.2.x 没有这个新增入口。不要通过 `v-html` 或 `dangerouslySetInnerHTML` 渲染编辑内容，也不要在 render/setup 中创建实例。

声明的 peer 范围为 React 18.2–19、Vue 3.5；本轮自动化使用 React 19.2.8、Vue 3.5.42。SSR 支持不等于对全部 Next/Nuxt 版本的认证。

[运行完整表单示例](/zh-CN/examples/vue)
