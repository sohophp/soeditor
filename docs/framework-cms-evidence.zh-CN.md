# React / Vue CMS 适配验收

本次新增独立的 `@soeditor/react/cms` 与 `@soeditor/vue/cms` 组件入口。
旧 Workspace hook/composable 保持兼容。接入示例见 [框架适配文档](framework-adapters.md)。

## 修复与覆盖

- React StrictMode 挂载、受控 HTML、外部属性更新、只读切换、原生表单提交和重置。受控回传在提交阶段同步，避免延后 Effect 用旧值覆盖后续输入。
- Vue `v-model`、初始 textarea 重置基线，避免重渲染覆盖编辑器同步的值。
- 异步创建期间更新属性、卸载后完成创建的销毁、重复挂载。
- 实际键盘输入与撤销/重做；Source 启用不加载运行时，首次激活才加载。
- React 上层事件捕获引起的 MutationObserver 提前执行：原生输入提交前保留浏览器修改；取消输入后自动恢复异常 DOM 修改检查，销毁时清理定时器。
- Node SSR 输出转义 textarea HTML，不在服务端初始化编辑器。

## 本地验证

文档审计的顶层 `test()` 静态登记数从 281 增至 285；该旧计数器不展开循环中的参数化测试，实际执行数以 Playwright 结果为准。

- `pnpm test:browser:frameworks --project chromium --repeat-each 3`：21/21，通过 7 个场景各三轮，其中包含旧 Workspace 兼容回归。
- Node SSR：React 与 Vue 各 2 个用例通过，覆盖旧入口及新增 CMS HTML 转义。
- 全仓 `pnpm typecheck`、`pnpm lint`、`pnpm build` 已通过；`pnpm test` 的全部阶段通过：415 个单元用例、性能预算、API、文档、tarball consumer、分发、发布检查、169 个产品 Chromium 用例和 16 个桌面/移动 CMS 用例。首次全量命令停在文档静态场景计数，更新 281 → 285 后从该阶段续跑至完成，未重复已经通过的前置检查。
- tarball NodeNext consumer 覆盖新增组件的导入与 props 类型；分发检查验证 CMS 入口只动态导入编辑器、不引入 Workspace/Source/Markdown，并保留 React `use client`。

### 构建与交互

| 产物               | 原始字节 | gzip 字节 |
| ------------------ | -------: | --------: |
| React CMS 适配入口 |     3217 |      1002 |
| Vue CMS 适配入口   |     3180 |      1033 |
| 默认 CMS global    |   484514 |    149768 |

适配入口数字不包含 React/Vue peer 或编辑器本身。新增入口与旧入口独立；
原有大小预算保持不变。默认 global gzip 仍低于既有 150000 字节上限。

[CMS 加载测量](evidence/framework-cms-loading.json) 的现有预算全部通过，
覆盖 10/100/500 KiB 文档、首次 Source、再次 Source、独立格式化与销毁。
例如 10 KiB 文档冷创建 94.9 ms，启用 Source 的首次切换 169.8 ms。

[框架输入测量](evidence/framework-cms-interactions.json) 使用本机 Chromium
与 Vite 开发服务器，期间有其他仓库检查运行；对 React/Vue 各测三轮、
每轮 100 次真实键盘输入，验证全部 600 字符正确回传。计时从 `beforeinput`
到随后 `requestAnimationFrame`：各轮中位数 8.1–9.3 ms，P95 为
15.8–17.7 ms。这是小文档本机观测，不是生产部署或大文档输入性能认证。

### 未完成的环境验收

本轮自动化实际使用 React 19.2.8 与 Vue 3.5.42；声明的 peer 版本范围未逐版本做矩阵验收。

完整三浏览器命令已尝试：Chromium 通过；Firefox 启动时报
`GLIBCXX_3.4.26 not found`，WebKit 缺少 GTK/GStreamer/flite 等系统运行库，
因此这两组没有执行产品断言，不能声明通过。保留
`pnpm test:browser:frameworks` 供具备依赖的环境重跑。
人工 Safari、屏幕阅读器、真实 IME 设备和全部 Next/Nuxt 版本未认证。
本次不发布包；新增公共组件入口按后续 minor release 管理。
