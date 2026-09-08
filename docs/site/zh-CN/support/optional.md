---
title: '可选与兼容能力'
description: 'CMS 主线是 WYSIWYG 与可选 Source。视频使用显式 /video 入口，文章预览通过可选入口配置；只有宿主实际需要时启用。'
---

# 可选与兼容能力

CMS 主线是 WYSIWYG 与可选 Source。视频使用显式 `/video` 入口，文章预览通过可选入口配置；只有宿主实际需要时启用。

历史 Markdown、审阅、评论、开发工具及 Workspace 框架 hook/composable 属于独立兼容能力，不在本站默认演示中加载。本页面仅说明其定位，不构成扩展产品范围的承诺。

已有使用者应遵循对应版本的公开 API 和迁移政策。内部架构与历史说明可在[仓库文档](https://github.com/sohophp/soeditor/tree/master/docs)查看；它们可能描述尚未发布的工作。

## CMS 框架集成

新的 [React](/zh-CN/guide/react) 与 [Vue](/zh-CN/guide/vue) CMS 组件提供普通网站表单的薄适配层；不改变框架无关 Core。它们已在 1.3.0 发布，使用独立入口。视频的发布版用法见[视频指南](/zh-CN/guide/video)和[运行示例](/zh-CN/examples/video)。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
