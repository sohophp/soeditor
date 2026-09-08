# 文档站 React、Vue 与视频更新

新增中英文各 6 页：React / Vue / 视频指南与对应示例。导航、语言切换、搜索、API 入口说明、可选能力与更新记录同步更新；每种语言现有 43 页。

## 版本与运行方式

- 正式模式继续固定 npm 1.2.1，仅构建发布包示例。视频提供同源 WebM、编辑卡片、规范 HTML 和独立文章预览播放。
- React/Vue `/cms` 组件尚未发布，正式页展示说明与完整代码，不提供指向缺失产物的运行按钮。
- `DOCS_WORKSPACE_PREVIEW=1 pnpm docs:dev` 可在本地运行框架组件。首次使用需先构建 editor、react、vue 包；具体命令见站内指南。
- 工作区预览自动标记 noindex、禁用 sitemap，并在部署清单标明 `workspacePreview`。部署检查拒绝此类产物；普通 PR 预览的发布包约束不变。
- 下载的 `soeditor-examples-1.2.1.tar.gz` 包含视频源码和媒体，但不包含尚未发布的框架组件示例。框架源码位于 `docs/site/examples/frameworks/`。

## 验证

- `pnpm docs:check`：Vue/TypeScript 检查、双语与链接检查、4 个部署门禁用例通过。
- `pnpm lint` 通过。
- 正式模式和工作区预览均构建成功；最终恢复为正式模式，构建产物链接检查覆盖 5748 项。
- 正式模式首轮桌面/移动测试：53 个通过，1 个仅用于固定 Chromium 性能测量的移动重复项跳过。视频示例的配置问题修正后，正式模式定向回归 10/10 通过，包含视频播放、组件版本边界和两种语言的搜索。
- 工作区预览桌面/移动定向回归 22/22 通过，覆盖新页面、React/Vue 绑定、原生表单提交/重置、只读、Source、重建与视频预览。
- 发布版下载源码解压后独立执行 `pnpm install --offline` 和 `pnpm build` 成功。
- 文档首页移动性能观测：360×800、4 倍 CPU 降速、40 ms 延迟/10 Mbps，三轮中位 LCP 532 ms、CLS 0；未提前请求演示资源。

本次完成本地文档、构建和 Chromium 桌面/移动自动化，没有部署线上或发布 npm 包。Firefox/WebKit 受本机已知运行库缺失限制，未在本轮重新认证。
