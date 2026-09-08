---
title: '升级指南'
description: '本网站以 1.3.0 为接入基线。升级时同步所有显式安装的 @soeditor/* 包版本，保留原始 HTML 样本和可回退构建。'
---

# 升级指南

本网站以 1.3.0 为接入基线。升级时同步所有显式安装的 `@soeditor/*` 包版本，保留原始 HTML 样本和可回退构建。

从旧的广泛入口迁移至 CMS 时，改用 `/cms` 或 `/cms/optional` 及 CMS 样式。Source 必须验证首次激活加载，不能仅检查按钮是否出现。

1.2 增加可选视频、文章预览和工具栏抽屉等能力；现有集成不需要默认启用。升级后回归表单、保存、粘贴、表格、图片和销毁。

历史 API 不因默认入口变窄而自动删除。低层集成请同时检查对应版本的公开类型。

## 下一步

[运行示例](/zh-CN/examples/basic) · [配置参考](/zh-CN/api/configuration) · [常见问题](/zh-CN/support/troubleshooting)
