# SoEditor 文档站验收记录

日期：2026-09-08。该记录区分本地检查、npm 发布与正式域名验收。

## 发布版基础

- 编辑器补丁提交：`d16e9538ed748da1af74eff060ce984d3f1f2d9d`（完整身份以 [CI 运行](https://github.com/sohophp/soeditor/actions/runs/34232783819) 为准）。
- [1.2.1 发布工作流](https://github.com/sohophp/soeditor/actions/runs/34232791725) 成功，包含 npm 消费者、24 个包的发布元数据与 CDN 生命周期验证。
- 文档依赖精确固定 npm 发布包 1.2.1，构建拒绝 workspace 编辑器源码。
- 普通编辑、原生表单和多实例使用 `/cms`；Source、保存和外部资源插件使用 `/cms/optional`。
- 1.2.1 预打包 `/cms` 与外部 UI 插件的注册表身份存在兼容边界，资源示例采用模块化可选入口，详见[公开入口说明](site/zh-CN/api/imports.md)。

## 本地站点检查

环境：Node 22.14.0、pnpm 11.20.0、Playwright 1.62.1 Noble 容器；Wrangler 4.128.0 使用真正的 Workers Static Assets 路由。

- 37 页中文与 37 页英文完整对应，构建检查 4,494 个链接、锚点和资源引用。
- 严格 TypeScript、文档检查、lint 与依赖安全审计通过；审计无已知漏洞。
- 四种配置：Chromium、Firefox、WebKit、360px 移动 Chromium。
- 浏览器测试 73 项通过；3 项跳过是固定 Chromium 性能测量在其他项目中的重复项，不是未通过的功能测试。
- 六个示例初始化、表单提交/重置、保存失败/重试、上传失败/重试、资源选择、实例隔离均通过。
- 每种浏览器配置执行 20 次实例重建和 20 次进入/退出示例，编辑器 DOM 数量稳定，关闭及切换路由后没有残留 iframe。
- 普通阅读和未启动演示无编辑器请求；Source 与格式化运行时各自在首次激活对应操作时加载。
- 中英搜索定位到 Source、保存、上传和表格指南；文档外壳浅色首页与深色文档页无 axe serious/critical 问题。
- 部署产物篡改、缺失和越界符号链接三个拒绝测试通过。
- 下载的完整示例在独立目录安装和构建通过。
- 精确版本 CDN 接入代码在独立空白页验证初始化、读取 HTML 和销毁成功。

移动性能：360×800、1×设备像素比、4× CPU 降速、40 ms 延迟、10 Mbps 下载，三个全新浏览器上下文。LCP 中位数 **576 ms**，CLS **0**，首次资源传输约 **280 KB**。这是本地 Workers 服务的固定模拟结果，不是全球生产用户性能数据。

## 部署与恢复证据

正式部署结果、版本 ID、提交和 lockfile SHA-256 由 Docs Site Deploy 的 Actions Summary 与 `docs-deployment-record` 记录。通过线上检查后才进入 `docs-deployment-archives`，保留最近十次及所有不足 90 天的成功产物。

[正式站检查](https://github.com/sohophp/soeditor/actions/runs/34238901121)与
[同提交仓库 CI](https://github.com/sohophp/soeditor/actions/runs/34238901123)已通过。
更新 Cloudflare 凭据后，[正式部署及归档](https://github.com/sohophp/soeditor/actions/runs/34239363996)于 2026-09-08 15:10 UTC 成功。

- 正式域名：[soeditor.sohophp.app](https://soeditor.sohophp.app/zh-CN/)，绑定 Worker `soeditor-docs`。
- 首次验收提交：`cda8c6981ec2438811850d14a7d9995c5fc4a463`；编辑器版本：`1.2.1`。
- Worker 版本 ID：`8033ed2e-570e-4895-b6d6-61613be726f8`。
- 锁文件 SHA-256：`eb875278f4cec2607b2625070acd7416575060aa03f876433270813a44e3f419`。
- Actions 线上检查通过 HTTPS、中英首页和深层页面、根路径 302、真实 404、示例与静态资源、缓存头、示例 noindex、正式 sitemap；线上部署标识与已检查提交一致。
- Chromium 经本地网络代理访问正式域名，六个示例均完成初始化与规范 HTML 读取；文档页点击启动 iframe、关闭清理通过，没有页面脚本错误。这是线上功能验证，不作为生产网络性能测量。
- 部署记录 `verified: true`、`rolledBack: false`；恢复产物已存入 [docs-deployment-archives](https://github.com/sohophp/soeditor/releases/tag/docs-deployment-archives)。
- 本地直连 Cloudflare 网络不可达；Actions 的 HTTPS 检查与本地代理浏览器检查均成功，不能据此推断所有地区的直连可用性。

旧 PR 合并后，其预览重跑因失去可信 PR 关联而被检查阻止；正式上线成功不代替新 PR 的预览部署验收。配置与恢复步骤见[运维说明](site-operations.zh-CN.md)。

## 人工与长期检查边界

WebKit 自动化不等于真实 Safari 认证。读屏、操作系统 IME、实际 Office 粘贴来源、目标地区网络与长期堆内存趋势尚需人工或长期验证。本次不把 DOM/iframe 清理检查宣称为内存泄漏的完整证明。
