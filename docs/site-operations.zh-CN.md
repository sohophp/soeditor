# SoEditor 文档站运维

## 本地开发

使用仓库 `.nvmrc` 和 `packageManager` 指定的 Node / pnpm。

```sh
pnpm install --frozen-lockfile
pnpm docs:dev --host 0.0.0.0
pnpm docs:check
pnpm docs:build
pnpm docs:preview
pnpm docs:test
```

`docs:dev` 启动前构建 iframe 示例；修改示例源码后重启开发命令。
`docs:preview` 使用 Wrangler 在 4175 端口提供真实 Workers 资源路由。
不支持 workerd 所需 glibc 的 WSL 发行版，应在 Ubuntu/Playwright 容器
运行 Wrangler 和浏览器测试，不以 Vite 开发服务器代替路由验收。

## 内容与版本

站点源码仅在 `docs/site/`，中英页面一一对应；内部规格和证据不发布。
公开示例使用 npm 别名固定发布版，构建拒绝 workspace 编辑器源码。
升级时同步文档包中的所有 `@soeditor/*` 版本、构建/检查脚本的版本守卫、
示例下载包版本、UI 版本和更新记录，再进行完整验证。

当前正式文档对应 1.3.0，React、Vue、视频示例和下载源码均使用精确的 npm 发布版本。
文档升级必须等待对应 npm 包发布并验证完成；不得以工作区包冒充发布版。
1.2.0 默认 CMS ESM 的初始化缺陷已在 1.2.1 修复，1.3.0 保留该修复。

## 自动发布

- Docs Site Check：每个 PR 和 master 提交构建并验证站点，保存资源和校验和。
- Docs Site Deploy：只消费成功检查的产物；正式发布等待同一 master SHA 的
  CI 成功，并在发布前再次检查最新 master。过期任务失败关闭，不覆盖新版本。
- 同仓库 PR 上传 `soeditor-docs-preview` 的版本预览；fork 不获得 Token。
  预览地址只写到 Actions Summary，不自动发评论。
- 正式 Worker `soeditor-docs` 绑定 `soeditor.sohophp.app`。
  禁用其 workers.dev 和版本预览；预览 Worker 不绑定正式域名。

两个 GitHub 环境分别为 `docs-production`、`docs-preview`。
各自设置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`。
Token 需要 `Account → Workers Scripts → Edit`，账号资源范围必须包含对应账号。
正式环境还需要 `Zone → Zone → Read` 和 `Zone → DNS → Read`，限定到
`sohophp.app`。自定义域名列表与绑定接口使用 Workers Scripts 权限；只有
DNS 编辑权限不够。按最小范围配置，不把 Token 写入源文件或示例资源。
[自定义域名 API 权限](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/)。

首次绑定前检查 Zone 为 active，且目标域名没有别的 Worker 或已有 DNS
服务。发现冲突立即停止，不自动覆盖。先完成域名所有者审核再重新发布。

## 预览、SEO 与缓存

预览构建设置 `DOCS_PREVIEW=1`，添加 noindex/nofollow 响应头，不生成 sitemap。
正式页面使用固定域名 canonical 和双语 alternate，根路径 302 到简体中文。
不存在页面返回 404；禁止 SPA 首页兜底。iframe 示例单独 noindex。

哈希 JS/CSS 长期缓存，其余资源重新验证。部署后核对 deployment.json 的
提交标识与预期一致，避免把缓存中的旧页面误认为新版本上线。

## 预览验收步骤

同仓库 PR 的 Docs Site Check 成功后，在 Docs Site Deploy 的 Summary 打开
版本预览 URL。核对 `/deployment.json` 的 commit 与 PR head 一致，确认
首页响应带 `X-Robots-Tag: noindex, nofollow`，且 `/sitemap.xml` 返回 404。
测试搜索和示例后保留对应运行链接。更新 PR 会产生新的版本 URL；旧 URL
不会成为正式站点入口。正式站点仍只跟随检查通过的 master 提交。

## 恢复与保留

每次成功正式部署将 dist 和 checksums 保存到专用 prerelease
`docs-deployment-archives`，不标记为 latest，也不发布编辑器包。
保留至少最近十次成功产物，并且任何不足 90 天的产物都不删除。
普通 Actions 测试产物保存 90 天，失败 trace 保存 14 天。

运行 Restore Docs Site，输入该归档中的完整 `docs-<timestamp>-<sha>.tar.gz`
名称。工作流校验版本身份和所有文件哈希后重新部署，并执行线上冒烟检查。
自动发布的线上验证失败时，若已有上一部署，则恢复之前的 Worker 版本分配，
再验证恢复后的站点。首次部署没有历史版本时会报告失败，不声明恢复成功。

Docs Daily Smoke 每日检查双语页面、深层链接、静态资源、根路径与 404。
失败通过 Actions 状态体现，不额外发邮件或聊天消息。

## 验收边界

记录 `.vitepress/reports` 的浏览器结果、模块图、校验和及移动端三次性能测量。
保持编辑器既有 bundle 预算，不因文档站新增功能提高它们。
真实 Safari、读屏、操作系统输入法、Office 来源以及目标地区网络需要独立人工验收。
本地测试、CI、npm 发布和正式域名验收分别报告，不能互相替代。
