---
title: 'Vue 表单示例'
description: '运行绑定、只读、表单提交重置和 Source 示例。'
---

# Vue 表单示例

<EditorDemo example="vue" />

## 安装与运行

`/cms` 组件从 1.3.0 起正式发布；原有 `useSoEditorWorkspace` 入口继续兼容。

```sh
pnpm add @soeditor/editor@1.3.0 @soeditor/vue@1.3.0 vue
```

点击示例的“开始体验”运行已发布的软件包。[下载完整示例源码](/downloads/soeditor-examples-1.3.0.tar.gz)，解压后执行 `pnpm install` 和 `pnpm dev`，打开 `vue.html`。

## 体验步骤

1. 编辑文章文字，查看下面的绑定 HTML 是否同步。
2. 点击“替换 HTML”，确认外部状态更新到编辑器；切换只读后不能继续编辑。
3. 点击“提交表单”查看 textarea 的规范 HTML；“重置表单”恢复本次挂载的初始值。
4. 点击“HTML Source”观察首次加载；“重建示例”用当前绑定值创建新实例。结束体验会移除整个 iframe。

## 完整示例源码

此演示用 Vue 的 `h()` 写法保持无需 SFC 编译插件；`modelValue` 与 `onUpdate:modelValue` 对应模板的 `v-model`。

<<< ../../examples/frameworks/vue.ts

<<< ../../examples/frameworks/shared.ts

<<< ../../examples/vue.html

[接入说明](/zh-CN/guide/vue)
