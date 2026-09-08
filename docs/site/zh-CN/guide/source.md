---
title: '启用 HTML 源码'
description: "使用 /cms/optional 并设置 editingModes: ['wysiwyg', 'source']。默认保持可视化编辑；首次进入 Source 或源码分屏时才下载并初始化源码编辑器。"
---

# 启用 HTML 源码

使用 `/cms/optional` 并设置 `editingModes: ['wysiwyg', 'source']`。默认保持可视化编辑；首次进入 Source 或源码分屏时才下载并初始化源码编辑器。

示例函数中的 `setWorkspaceView` 应由用户操作触发。仅显示 Source 按钮不应提前请求源码运行时。等待切换完成后再访问相应界面。

源码包含错误时按界面提示修复，不要用当前可视化 DOM 覆盖原始内容。[体验源码切换](/zh-CN/examples/source)。

## 可运行代码

<<< ../../examples/api.ts#source

此代码使用发布版类型检查；完整导入说明见[入口与类型](/zh-CN/api/imports)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
