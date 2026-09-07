# CMS 性能与稳定性优化（2026-09-07）

## 当前状态与范围

本轮对应六项已接受建议：大文档输入、Source 切换、CMS 语料与人工验收、连续会话稳定性、默认体积余量、当前证据统一。代码优化、合成语料回归、重复会话自动检查和证据归档已完成；真实设备与真实 Office/客户素材人工验收待执行。本页是当前工作区的统一入口，早期阶段的完成数字不能替代本轮结果。

未提交工作保留；不改变公开 API、HTML 持久化格式、预算或可选加载边界。没有提交、发布、打标签或部署。

## 实现与验收要求

- WYSIWYG 使用实例内 WeakMap 缓存顶层节点的 canonical 序列化结果。MutationObserver 记录同步消费；文字、属性、结构、重新插入节点均失效。重新渲染和销毁清空缓存，无观察器时不复用。仍在每次编辑事务中同步生成完整 HTML，因此 `getData()`、提交和撤销不读取延迟草稿。
- 根编辑区属性属于投影状态，不触发正文外部修改修复。子节点的外部修改仍从 canonical HTML 修复。
- Source 仅在有效只读状态改变时重配 CodeMirror；协调器存在时使用协调器活动更新。首次激活加载、失败重试、分屏和单写入者契约保持。
- HTML 序列化的 `<br />` 规范化按整段文本复制，保留实体、原始文本和注释。
- 独立全局 CSS 排除不能跨越 Shadow DOM 的历史 light-DOM 表格与占位样式。WYSIWYG 的 Shadow DOM 内容样式和完整 ESM 兼容样式保留；这不是删除表格功能。
- 完整跨浏览器矩阵发现并在基线复现两处交互问题：WebKit 在工具栏文字被重复写入时丢失 summary 点击；Firefox 的短图片插段按钮遮住图片双击位置。现已保留未变化的文字节点，并让短图片的插段按钮位于图片外侧。原有图片、字体、标题和光标测试的八项跨引擎复测通过；没有改变操作断言或时间预算。
- 基线中的 WebKit 对 `li > p` 按 Enter 只拆段落。非空段落的折叠光标现在通过同一事务拆为两个列表项；部分复制的祖先 ID 不重复，完整移动的嵌套内容保留 ID，原项显式 `value` 保留而新项自然续号。DOM 克隆另行携带 inert 源码属性元数据，验证事件属性保留在源码而不出现在可执行 DOM 中。段首、中间、段尾及后续输入/撤销均有跨引擎断言；空项退出和非段落列表内容沿用原路径。

验收覆盖跨段删除、Enter、撤销重做、外部 DOM 修复、Source setData、立即表单同步、未知与 inert HTML、分屏及反复创建销毁。语料为[合成 CMS 产品正文](../tests/fixtures/cms/legacy-product.html)，不冒充客户脱敏文章或真实 Office 剪贴板。

## 可复现测量

[基线工作区清单](evidence/cms-optimization-2026-09-07/baseline-worktree.json)记录开始时 HEAD 和文件 SHA-256。HEAD 本身不能标识这些未提交修改；复现需要清单对应的完整工作区。构建后保存 `node_modules/.cache/soeditor-cms-loading/dist`，再构建修改后版本，分别传入：

```bash
node scripts/compare-cms-optimization.mjs /path/to/before-dist /path/to/after-dist /tmp/comparison.json
node scripts/profile-cms-optimization.mjs /path/to/before-dist /path/to/after-dist /tmp/cpu-profile.json
node scripts/measure-cms-stability.mjs /path/to/after-dist /tmp/stability.json
```

两份夹具必须使用相同依赖与生产压缩设置。对照运行期间不并行构建或测试。每种规模、每版 3 个新实例，交替先后顺序；每实例 2 次输入预热、10 个有效样本，测原生 beforeinput 到下一帧。输入时 Source 已配置但尚未激活；随后分别测量首次 Source 及再次进入。P95 仅是本机样本分位数，不能解释为跨设备服务等级。

当前[连续对照数据](evidence/cms-optimization-2026-09-07/comparison.json)：

| HTML 规模 | 输入中位 ms，前 → 后 | 输入样本 P95 ms，前 → 后 | 再次 Source 中位 ms，前 → 后 |
| --------- | -------------------: | -----------------------: | ---------------------------: |
| 10 KiB    |           10.3 → 9.6 |              16.1 → 13.0 |                  32.3 → 25.4 |
| 100 KiB   |          48.3 → 19.8 |              79.5 → 26.3 |                 126.0 → 52.0 |
| 500 KiB   |         233.2 → 85.0 |            272.3 → 112.6 |                461.8 → 147.7 |

500 KiB 首次 Source 中位 821.7 → 450.6 ms。10 KiB 中位数没有改善承诺；大文档仍存在完整 HTML 拼接、统计和布局成本。一个巨大的顶层节点会使块缓存收益降低，不称为任意 HTML 都已达低延迟。

[独立 CPU 采样](evidence/cms-optimization-2026-09-07/cpu-profile.json)用于定位热点，不与延迟样本混算。优化前五次输入中递归节点序列化采样自身耗时约 541 ms；缓存减少该路径重复工作后，完整正文统计等成本仍需关注。

[默认加载测量](evidence/cms-optimization-2026-09-07/after-loading.json)及失败重试检查通过，预算未上调。全局 CSS 从 26,910 降至 24,881 bytes（减少 7.5%）；全局 JS 为 481,638 bytes、gzip 147,664 bytes，低于 500,000/150,000 限额。JS gzip 相较基线 147,133 bytes 增加 531 bytes，因此本轮体积收益来自 CSS，JS 余量仍有限。Source、格式化和可选能力保持各自首次使用边界。

[稳定性采样](evidence/cms-optimization-2026-09-07/stability.json)执行 3 次预热及 30 次 100 KiB 创建、编辑、Source 往返、销毁，每轮三次 Source 往返。强制 GC 后检查点均为 292 个节点、52 个监听器，未出现页面错误。JS 已用堆由 6.98 MB 增至 8.11 MB，后半段增幅放缓；数据包含浏览器/库缓存及夹具保留的最后一个销毁包装对象，不证明完全无泄漏，也不替代数小时人工会话。浏览器回归另覆盖上传取消/失败/重试、菜单反复开关和多实例隔离。

## 人工验收与外部边界

见[设备与真实素材验收表](cms-manual-qualification.zh-CN.md)。真实 Safari、Windows 中文输入法、Word/Excel 剪贴板及屏幕阅读器需要人工设备操作；未取得结果前一律标为待执行。自动浏览器、合成 composition/clipboard、axe 和短时生命周期循环均不能替代人工认证。

## 最终验证

- `pnpm lint`、`pnpm typecheck`、完整 `pnpm test` 通过；完整测试链包含 `pnpm build`、404 项单元测试、138 项 Chromium 产品回归及 14 项桌面/触屏 CMS 回归。
- API、文档、256 项浏览器场景清单、性能门禁、打包消费者及 24 个包的分发/发布产物检查通过。原始完整链见 [validation.txt](evidence/cms-optimization-2026-09-07/validation.txt)。
- Firefox/WebKit 完整矩阵 [130 项通过、4 项跳过](evidence/cms-optimization-2026-09-07/cross-browser.txt)；跳过的是 Chromium 专用剪贴板/CDP 场景。其后列表 inert 属性保留修正再通过 [8 项针对性跨引擎回归](evidence/cms-optimization-2026-09-07/preservation-cross.txt)，最终代码亦通过上述完整 Chromium 链。没有将此前完整矩阵称为最终修正后的全量复跑。
- Source 三引擎专项 [21 项通过](evidence/cms-optimization-2026-09-07/source.txt)，之后 Source 实现未变。Firefox/WebKit 使用 Playwright 1.62.1 Noble 容器；自动 WebKit 不等于真实 Safari。
- 对照与加载、CPU、生命周期采样均在最终代码构建后单独运行，未与构建或浏览器回归并行。没有放宽断言、测试超时或冻结预算。

[最终工作区与产物清单](evidence/cms-optimization-2026-09-07/final-worktree.json)记录源文件、构建产物和归档 SHA-256。保留[基线源码](evidence/cms-optimization-2026-09-07/baseline-source.tar.gz)、[最终源码](evidence/cms-optimization-2026-09-07/final-source.tar.gz)及[两版测量构建](evidence/cms-optimization-2026-09-07/measurement-builds.tar.gz)。源码归档不含依赖目录及证据输出；依赖按各自锁文件安装。测量归档解压得到 `before-dist` 和 `after-dist`，可直接传入上面的对照命令；JSON 中临时目录只是本次运行位置。清单用于识别未提交工作区，不代表版本已发布。
