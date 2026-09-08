---
title: 'React 表单示例'
description: '运行绑定、只读、表单提交重置和 Source 示例。'
---

# React 表单示例

<EditorDemo example="react" />

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
