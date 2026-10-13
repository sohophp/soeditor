# Changelog

## Unreleased

### 变更

- 链接与图片链接属性共用文件选择、站内搜索和键盘建议；默认工具栏保持统一图片入口，旧独立快捷按钮仅显式配置时出现。新增可选 SoFinder／CKFinder 浏览器适配接口与使用文档，宿主只提供服务地址、认证配置和站内数据。

### 修复

- SoFinder 选择器／上传 SDK 初次加载失败后，下一次操作使用新的模块重试地址，避免浏览器缓存失败结果导致持续打不开；按中／繁／英区分重新登录、权限验证失败和临时资源错误，正常首次加载不增加请求，不绕过服务端身份检查。

- 图片上传成功后自动移除状态提示，不再保留「关闭」按钮；失败仍可重试，上传中仍可取消。仅清理界面，保留已插入图片、内容及任务记录，成功后切换视图不会重新显示旧提示。

- 底部状态栏在宽屏、窄屏和上传期间均保持单行固定高度；长文件名省略显示并可悬停查看，取消／重试／关闭按钮完整保留，多任务横向滚动，不覆盖后续编辑字段。

- 格式化改用独立的相对路径 Worker 资源，兼容仅允许同源脚本的 CSP；不再创建 blob Worker，保留按需加载、内容保护和不可用时的原回退。

- 修复表格列范围、粘贴失败提示前缀和未命名视频／预览默认标题的动态漏译；界面按实例语言显示，业务正文及外部诊断内容保持。

- 修复命名锚点等通用对话框确认按钮由英文拼接造成的漏译，插入动作按实例语言显示；补齐当前 CMS 富文本命令的简体／繁体词条，扩展静态检查范围。

- 补齐图片插入、颜色、字符、表格结构、视频、上传和预览的简体／繁体 UI 词条；表格控件使用语言无关的原始键，视频不再把繁体界面固定成简体。Classic 根节点带实例语言，Source 搜索／替换、补全和配色按实例本地化，保留按需加载和原正文。

- Classic 源码模式保留已配置的撤销、重做和重设编辑按钮。撤销／重做命令在只读状态拒绝执行，保留历史供解除只读后继续使用。

- HTML Source 默认使用浅色，可在源码区顶部即时切换暗色；两种配色均提供清晰的光标、聚焦边框、当前行／行号及补全菜单。选择独立于正文和撤销历史，在当前编辑器内切换视图后保留，不写入用户后台偏好。
- 源码输入不再重复校验相同全文，错误标记延后 300 ms 更新，保存和切换视图仍立即校验最新内容。仅源码可见时暂缓隐藏 WYSIWYG 的全文重绘，重新显示时刷新最新内容，分屏继续实时同步。

### 验证

- 2026-10-10 SoFinder 模块重试：adapter 15 项单元、类型／构建、改动文件 lint／格式及 API 24 包报告通过；Chromium 四条英文／简体／繁体 401／403／503 加载恢复流程通过，Core 两种提供者 72 项回归通过；真实开发机本地管理员使用编译后的 adapter，在模拟首次 503 后无需刷新即可打开真实 SoFinder 窗口。用户截图对应登录失败未复现，Windows 人工与生产验收另列。

- 2026-10-10 成功提示自动清除：FileManager 35 项单元、类型与构建、API／分发检查通过；原生 Chromium 宽／窄屏及上传重试／取消三条流程、Core 两种文件管理器 72 项隔离检查通过，覆盖成功后无提示、任务记录及图片保留、切换视图后不重新出现。没有本次真实管理员业务上传或 Windows 人工验收。

- 2026-10-10 上传状态栏：UI／FileManager 47 项单元、类型／构建、改动文件 lint／格式、API／分发 24 包审计通过；Chromium 在 1280／420px 验证多任务、长文件名省略、源码切换、键盘关闭及上传期间高度保持，原上传重试／取消流程保持。Core 两种提供者 64 项隔离检查及构建 CSP 回归通过；不包含正常后台上传或 Windows 人工验收。

- 2026-10-10 格式化 CSP 修复：HTML-tools 49 项单元、类型与构建通过；Core 实际构建在嵌套路径和真实 CSP 下格式化、压缩及历史通过，Worker 正常执行且没有控制台错误；Core Source 66 项及原生 Chromium 4 条聚焦流程通过。原生开发 HMR 本地网络诊断单列，非真实后台或全浏览器验收。分发／API 24 包审计保持；未公开发布。

- 2026-10-10 图片／链接阶段：FileManager／SoFinder adapter／UI／Editor 共 70 项单元，相关类型、构建、lint／格式、API 24 包报告及双语文档检查通过；Chromium 共 8 条聚焦流程，含两种链接提供者、三语及 global 懒加载控件。global 原体积预算保持（487.14 kB raw／149.69 kB gzip），没有真实后台、Windows 人工或公共发布；通用接口说明见 `docs/assets-and-links.zh-CN.md`。

- 2026-10-10 动态文案补查：246 个字面 CMS UI 键缺漏为 0，UI／Editor 共 20 项单元、三语 Chromium 3 条完整流程、类型／构建、改动文件 lint／格式与 API 24 入口检查通过。覆盖命名锚点确认及取消、未命名视频首次标题与初始 HTML 保持；Editor global 为 487.15 kB raw／149.70 kB gzip。没有真实后台、其它浏览器或 Windows 人工验收。

- 多语言阶段：227 个 CMS 静态 UI 键检查无缺漏；UI／Source／Preview／Editor 共 29 项单元、类型／构建和改动文件 lint／格式通过。Chromium 英文／简体／繁体实际控件 3 项通过，Source 12 项、视频／语言／工具栏聚焦 18 项和修正中文预期后的完整 CMS 演示 1 项通过。公开 API 24 个入口签名保持，更新内部声明树摘要；本轮未包含 Firefox／WebKit、正常后台登录或 Windows 人工验收。

- 历史操作阶段：Engine 61 项与 Source 5 项单元、两包类型检查／构建、改动文件 lint／格式及公开 API 24 个入口检查通过，Chromium Source 扩至 12 项，包含源码历史按钮和只读拒绝。Source index gzip 13.68 kB、恢复资源 gzip 247.42 kB；不包含完整发布或人工验收。

- 全仓 lint、类型检查及单元测试通过，公开 API 24 个入口报告一致，Chromium Source 回归 11 项通过，含配色、补全、撤销、隐藏区刷新、分屏、延迟加载／恢复及无效草稿保护。Firefox／WebKit 因系统运行库不足无法启动，不计通过。
- 单轮本地合成 HTML 测量：131,204 个 UTF-16 码元（UTF-8 145,442 字节），连续 32 键的下一帧延迟 p95 从 302.3 ms 降至 168.3 ms；隐藏区重绘从 32 次降至 0 次，超大正文仍有延迟。测量脚本为 `scripts/measure-source-typing.mjs`；Source index gzip 13.66 kB、恢复资源 gzip 247.41 kB，没有新增运行依赖，未做完整发布或 Windows 人工验收。

## 1.5.0 — 2026-10-07

### 变更

- 可选 Source 入口的中文字典按语言加载；画布预设仅在配置画布或打开预览时加载，继续沿用原有加载体积门禁。

- ESM 工具栏的链接、颜色、图片与表格面板改为首次使用时加载，保留现有启动体积预算与工具栏入口。

### 修复

- 首次异步打开工具期间保留冻结的编辑选区，修复 WebKit 链接文字与颜色状态丢失；格式化 worker 压缩打包，保留既有首次格式化体积预算。

- 兼容 WebKit 在空换行占位内容上省略 beforeinput 的删除行为；跨浏览器回归检查按元素语义验证属性和未知 CMS 元素，不依赖属性顺序或标签换行。

### 验证与迭代

- 文档视频示例的播放回归定位同步新版隔离预览框架，继续检查编辑区不播放、保存真实 HTML 与文章预览实际播放。

- 颜色面板首次按需加载后再执行尺寸回归断言，保留原有按钮布局检查，避免网络加载时序影响测量。

- 验证：完整 CI 和发布前复检通过类型、单元、性能、API、打包消费者、分发、Chromium／Firefox／WebKit、安全及原有加载预算检查；24 个 npm 包与 CDN 产物已发布为 1.5.0，初次 npm 元数据同步超时后公开复验通过。真实设备与人工验收边界另见发布记录。
- 中英文文档、安装指引、React／Vue 示例和下载项目统一升级到已发布的 1.5.0；补充粘贴选择、格式化错误定位与自托管配套资源说明。

- 更新测试和文档构建工具的安全补丁，修复发布审计发现的高危与严重依赖漏洞；不新增编辑器运行时依赖。尚无上游修复的 braces 通过有回归验证的本地深度限制补丁处理，审计中单独记录。

- 新增可选的富文本粘贴选择，支持保留格式、清理格式和仅保留文字；默认维持自动粘贴，取消不修改正文。
- Source 格式化／压缩失败时显示本地化原因、行列和错误代码，保留原文与撤销历史。
- 支持安全选择与解除元素包裹，按宿主内容基础 URL 显示图片预览。
- 中文语言包、链接工具和粘贴选择在 CDN 全局构建中独立加载；自托管需保留完整 dist 目录。

- Clear the selected heading or paragraph's inline style when removing formatting, including inert preserved styles, while retaining its block tag and metadata.

- Allow semantic external paste to discard all inline styles with `cms.paste.retainAlignment: false`, without changing Source text paste or explicit preservation policies.

- Preserve external paste source, authored table alignment, classes, safe CSS, and unchanged visual blocks without reserializing them when another block is edited.

- Omit neutral browser clipboard `text-align: start` during default semantic paste cleanup while preserving authored overrides and explicit preservation policies. Keep literal whitespace in nested code blocks. Format source without rewriting text, attribute quoting, entities or embedded data; minify directly from source offsets rather than reserializing HTML.

- Use the Link dialog's remaining panel height for internal-page suggestions, align fields across tabs and cap the dialog width independently of the host font size.

- Replace the Link dialog's expanding advanced settings with keyboard-accessible Basic settings / Advanced settings tabs that retain values and share a stable dialog size.

- Keep internal-link suggestions and URL input geometry stable during asynchronous searches, disable stale results until refresh, and scroll keyboard choices within the list. Fit the reserved list space to short viewports and enlarged text.

- Reduce the responsive webpage editing canvas padding from 24px to 1rem and remove the first top-level block's extra browser margin while retaining the existing device and document preset spacing.

- Show HTML Source lazy-loading progress in the editor status bar and restore the normal status immediately when loading finishes, avoiding a flashing floating notification for fast loads.

- 重构 CMS disclosure 为始终可见的原生 summary 控制条，移除全局就绪观察器及工具栏定位耦合；支持宿主按语言独立创建，销毁折叠包装时保留异步挂载节点。

- Redesign the image-properties preview as a responsive preview card and replace the verbose original-size and filename-to-alt actions with quiet, accessible icon controls.
- Match the dialog resize grip to the familiar three-line Chrome textarea resize indicator while retaining its larger accessible pointer target and keyboard behavior.

## 1.1.0 — CMS WYSIWYG + Source

- Add the lightweight CMS Classic Editor with textarea binding, canonical HTML preservation, inert unknown/unsafe content, form submit/reset, dirty state and safe teardown.
- Load optional HTML Source on first use, keep formatting and recovery behind separate demand boundaries, and support bounded horizontal/vertical WYSIWYG + Source views.
- Improve table selection and resizing, nested lists, block formatting, links, image properties/alignment/resizing, keyboard controls, localized menus and upload/asset integration.
- Prevent queued color-menu initialization from overwriting a color entered immediately after opening the menu.
- Restore Show Blocks in the Classic demo and isolate the read-only element path from document statistics; Source no longer reports CodeMirror DOM as a body path.
- Count semantic body text across block boundaries, exclude source indentation and static hidden content, and define deterministic Chinese/Japanese character and other word units.
- Add `@soeditor/editor/content.css` for frontend rendering of saved image alignment, sharing the editing rules without editor JavaScript.
- Reduce repeated serialization work, defer coalesced statistics, and prevent accumulated Source parsing cost during external history updates. Add reproducible article, image-list and table baselines.
- Align all 24 public MIT-licensed packages at 1.1.0. Retain historical compatibility capabilities behind explicit entries and document migration from 1.0.

Owner-authorized for publication on 2026-09-08. Publication and registry/CDN verification are recorded in the GitHub release and publishing workflow; local builds alone do not prove publication.

Automated evidence: 406 unit tests, 145 Chromium product tests, 16 CMS desktop/touch tests, 148 Firefox/WebKit checks (4 existing Chromium-only skips), and 27 Source checks. Real-device Safari, OS IME, Office clipboard, assistive-technology and customer-material qualification remain unverified. See [current acceptance](docs/cms-followup-2026-09-08.zh-CN.md).

## 1.0.0 — Stable release

- Froze and classified every declared public package entry with generated
  symbol/signature and declaration-tree compatibility evidence.
- Documented the 1.x compatibility, deprecation, runtime, security,
  maintenance, migration, troubleshooting, deployment, and operations
  contracts.
- Added Source/Markdown CSP nonce forwarding, dark-theme and forced-colors
  fixes, explicit-GC retention and accessibility qualification gates.
- Aligned all 23 MIT-licensed public packages, framework adapters, plugin
  tooling, packed consumers, ESM/global artifacts, and release checks at 1.0.0.
- Advanced the plugin scaffold to template version 2 with 1.x SDK peer and
  development ranges; the checker now rejects pre-1.0 SDK ranges.

All 23 packages were published from commit
`f6196545a0054fda3f63a10ead5b21e86ec90339`. Public npm installation and
jsDelivr/Chromium lifecycle verification passed after registry propagation.

## 0.9.0 — Integration candidate

- Added a private framework-neutral workspace controller with explicit ordered
  attachment factories, reverse teardown, controlled/uncontrolled value
  policies, observable lifecycle snapshots, and opt-in bounded recovery from
  the last known canonical source.
- Added focused unit and Chromium coverage plus an executable Workspace demo;
  public 0.9 exports remain deferred.
- Added private React and Vue lifecycle adapters with controlled values,
  readonly updates, SSR-safe rendering, React StrictMode/Error Boundary
  behavior, Vue Composition API lifecycle, and an executable comparison demo.
- Added private offline plugin scaffolding and static package checks targeting
  the 0.9 SDK, including script-free packed-artifact inspection and a generated
  plugin's clean NodeNext consumer workflow.
- Added immutable Workspace attachment requirements and bounded per-instance
  diagnostics for incompatible formats, missing services, unsafe Preview
  policy, failed recreation, and crash-limit termination.
- Promoted `@soeditor/workspace`, `@soeditor/react`, `@soeditor/vue`, and
  `@soeditor/plugin-tools`; added Workspace to the framework-neutral umbrella
  while keeping framework and Node-only dependencies in their owning packages.
- Added 0.8-to-0.9 migration guidance, packed consumers for all 23 public
  packages, framework/CMS/SSR verification, and measured integration budgets.
- Added a generated symbol/declaration API report and explicit candidate 1.x
  compatibility, deprecation, runtime, security, and maintenance policies.
  This entry describes a verified local release candidate. npm publication, the
  `v0.9.0` tag, hosted release, and registry/CDN verification remain pending
  explicit owner authorization.

## 0.8.0 — Review Workflow candidate

- Added bounded, non-canonical visual decorations and the public
  `@soeditor/comments` package with immutable mapped ranges, host-owned atomic
  storage, permission boundaries, command-driven review UI, and safe unlinking
  when a document change cannot be mapped precisely.
- Added unit and Chromium coverage for text and structured-block comments,
  source/history behavior, clipboard isolation, readonly review permissions,
  accessibility, adapter failures, serialized writes, and teardown.
- Added public host-owned revision history with bounded HTML/Markdown
  comparison, explicit transaction restore, dynamic edit/comments-only/
  readonly policy across editing projections, and deterministic comment
  behavior across viewing and restoration.
- Added immutable, versioned review-data exports; distinguished reversible
  comment tombstones from permission-checked permanent erasure; and added
  optional host-confirmed revision erasure.
- Added curated SDK and umbrella exports, a packed NodeNext/native ESM storage
  adapter consumer, 0.7-to-0.8 migration and privacy guidance, and aligned all
  19 MIT-licensed public packages at `0.8.0`.

This entry describes a verified local release candidate. npm publication, the
`v0.8.0` tag, hosted release, and registry/CDN verification remain pending
explicit owner authorization.

## 0.7.0 — Structured Extensions candidate

- Added deterministic structured block conversions, immutable editing models
  and operations, command-backed node views, and curated extension contracts.
- Added bounded production tables with row/column/header/merge/split,
  rectangular selection, keyboard, history, and semantic clipboard behavior.
- Added safe figure/media widgets with captions, alt text, dimensions, and a
  replaceable FileManager browse path while preserving inert unknown or unsafe
  source.
- Added a packed third-party product-card consumer proving that plugins can
  register, render, read, and replace structured content using package roots
  and the public SDK only.
- Aligned all 17 MIT-licensed public packages at `0.7.0` and hardened release,
  registry, accessibility, teardown, bundle, and migration gates.

This entry describes a verified local release candidate. npm publication, the
`v0.7.0` tag, hosted release, and registry/CDN verification remain pending
explicit owner authorization.

## 0.6.0 — Developer Workflow candidate

- Added bounded source-only accessibility and SEO diagnostic providers with
  per-rule severity/disable policy, isolated failures, immutable snapshots,
  filtered counts, and manual or debounced validation.
- Added persistent Visual, HTML Source, Markdown, and Preview coordination with
  exactly one compatible editing authority, readonly propagation, and safe
  invalid-source behavior.
- Added accessible, command-driven Visual | Source, Source | Preview, and
  Markdown | Preview layouts with keyboard/pointer resizing, responsive
  orientation, collapse/focus controls, and exact caller-host restoration.
- Extended the curated plugin SDK with diagnostics workflow and generic
  projection/layout contracts, and updated the immutable Developer preset
  without taking engine, DOM host, Preview-policy, or FileManager ownership.
- Added migration/configuration documentation, deterministic Playground routes,
  packed SDK adapter consumers, and a narrow production tree-shaking audit.
- Added `@soeditor/projections` and `@soeditor/layout`, aligning 17 MIT-licensed
  public packages at `0.6.0` for owner-reviewed publication.

This entry describes the verified release candidate. npm publication, the
`v0.6.0` tag, hosted release, and external registry/CDN verification remain
pending explicit owner authorization.

## 0.5.1 — Complete Developer Preview release set

- Advanced all 15 public packages together after the initial `0.5.0`
  publication stopped after 14 scoped packages and before the unscoped
  `soeditor` package.
- Kept the verified `0.5.0` artifacts immutable, adopted the owner-approved
  `@soeditor/editor` umbrella after npm rejected the unscoped name, and changed
  publication order to validate the umbrella before the other packages.
- Applied the selected npm distribution tag explicitly to both protected
  publication batches.
- Added bounded retry handling to the read-only npm availability preflight so
  transient registry throttling or server/network failures do not masquerade
  as release collisions.
- Wait for npm's abbreviated installation metadata to propagate before the
  post-publish clean consumer install, preventing a successful release from
  being reported as failed during registry index convergence.
- No product API or runtime behavior changed from the verified 0.5.0 release
  candidate.

## 0.5.0 — Developer Preview

First coherent SoEditor developer preview.

- Added instance-scoped Core lifecycle, immutable state, transactions,
  commands, plugins, services, and events.
- Added semantic HTML parsing/serialization and controlled visual editing with
  history, clipboard, rich-text commands, and unknown-content preservation.
- Added CodeMirror HTML Source and Markdown editing, diagnostics, explicit
  formatting, sandboxed Preview, developer tools, and framework-independent UI.
- Added generic FileManager integration, an injected SoFinder adapter, public
  plugin SDK, immutable presets, and the `soeditor` npm/browser distribution.
- Added clean NodeNext, native ESM, Vite, packed-package, and Chromium release
  gates.
- Added public npm metadata, publication dry runs, CI/manual release workflows,
  packed-manifest checks, and automated WCAG A/AA regression scanning before
  the initial registry publication.

See `docs/status.md` for Developer Preview limitations. There is no migration
from an earlier public SoEditor version.
