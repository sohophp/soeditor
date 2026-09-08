---
title: '执行命令'
description: '命令从 classic.editor.execute(id, ...args) 执行，并走编辑事务。执行前可以用 commands.canExecute(id) 检查当前状态，避免在只读或无有效选择时强制操作。'
---

# 执行命令

命令从 `classic.editor.execute(id, ...args)` 执行，并走编辑事务。执行前可以用 `commands.canExecute(id)` 检查当前状态，避免在只读或无有效选择时强制操作。

常见命令包括 `editor.undo`、`media.browse`、`image.upload` 和按需的 `document.format`。参数由相应功能文档定义，不把任意输入拼接为 HTML。

工具栏自带选择保持逻辑；宿主自定义按钮应在真实浏览器验证选择与焦点恢复。

## 可运行代码

<<< ../../examples/api.ts#commands

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
