---
title: 'React 表单示例'
description: '运行绑定、只读、表单提交重置和 Source 示例。'
---

# React 表单示例

<EditorDemo example="react" />

## 安装与运行

`/cms` 组件从 1.3.0 起正式发布，本站示例引用 1.4.0；原有 `useSoEditorWorkspace` 入口继续兼容。

```sh
pnpm add @soeditor/editor@1.4.0 @soeditor/react@1.4.0 react react-dom
```

点击示例的“开始体验”运行已发布的软件包。[下载完整示例源码](/downloads/soeditor-examples-1.4.0.tar.gz)，解压后执行 `pnpm install` 和 `pnpm dev`，打开 `react.html`。

## 体验步骤

1. 编辑文章文字，查看下面的绑定 HTML 是否同步。
2. 点击“替换 HTML”，确认外部状态更新到编辑器；切换只读后不能继续编辑。
3. 点击“提交表单”查看 textarea 的规范 HTML；“重置表单”恢复本次挂载的初始值。
4. 点击“HTML Source”观察首次加载；“重建示例”用当前绑定值创建新实例。结束体验会移除整个 iframe。

## 完整示例源码

<<< ../../examples/frameworks/react.ts

<<< ../../examples/frameworks/shared.ts

<<< ../../examples/react.html

[接入说明](/zh-CN/guide/react)
