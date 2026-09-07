# CMS 第二轮性能与稳定性验收（2026-09-07）

本轮承接六项建议。代码与自动验收已完成；不包含提交、发布、部署，也不把缺少真实设备/素材的项目标为通过。

## 范围与行为

| 项目        | 本轮工作                                                                                                                      | 验收边界                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 输入统计    | 内容变化后约 100 ms 合并计算，保存和 dirty 同步；字符计数不创建整篇字符数组；销毁取消任务                                     | 检查 Unicode、连续覆盖、立即读取正文与销毁后无更新                         |
| Source 切换 | 记录布局 trace；隐藏表面不读取原生选区；协调器统一更新活动状态；大文档外部删除/替换刷新 Source 解析输入，普通插入保留增量路径 | 选区、焦点、只读、两种分屏、延迟加载与失败重试不退化                       |
| 真实素材    | 提供文件校验工具，记录输入 SHA-256，执行修改、Source 往返、保存和重开                                                         | 仅有合成素材；真实 CMS、Word/Excel 和设备操作仍待提供                      |
| 大容器      | 增加单个 div 包裹全文的同机对照；增加嵌套 canonical 节点缓存及祖先/离线子树失效                                               | 不更换 canonical HTML，不直接保存投影 DOM；仍需完整 HTML 序列化            |
| 长会话      | 单实例持续编辑、历史、只读与所有 Source 视图，保留开始/结束/销毁堆快照                                                        | 自动诊断不等同 60 分钟人工输入法/Office 会话；堆自身大小不是支配树保留大小 |
| 默认体积    | 验证现代语法压缩；同一消息键集中存放简繁译文，保留全部语言值和公开接口                                                        | 冻结预算不变，检查实际 raw/gzip 与加载图                                   |

持续会话发现了必须修复的额外瓶颈：反复编辑和撤销后，Source 的增量语法树遍历耗时逐步增长。独立探针将热点定位到语法树遍历路径。现复用原 CodeMirror 实例与查找状态，对至少 65,536 个 UTF-16 单元的大文档外部删除或替换刷新解析输入，按最小差异映射选区；Source 自身输入仍由 CodeMirror 正常处理。新增回归检查连续外部修改、撤销重做后选区与查找值保持。

全量刷新外部同步曾使 10 KiB 文档在使用 Source 后输入变慢。最终策略保留小文档和纯插入的增量路径；64 KiB 左右是实现分界，本轮实测覆盖 10/100/500 KiB，不代表任意 HTML 的复杂度只由长度决定。

第一轮 15 分钟诊断保存在 `evidence/cms-followup-2026-09-07/pre-sync/`；完整刷新策略的 15 分钟重复诊断保存在 `full-sync/`，最终选择性策略再执行 5 分钟回归并单独记录。堆图中的部分旧 DOM 由 Blink 原生撤销栈持有，不能把挂载时的节点增长全部归于插件泄漏。工具保留销毁后的快照及根路径，说明浏览器历史与夹具持有包装对象的影响。

统计的首次显示仍同步完成。后续计数可短暂落后正文，连续输入时按固定待执行任务刷新，不因每次输入无限延后。计数仍消耗主线程时间，不能把移出单次输入计时窗口称为消除了全部 CPU 成本。

## 复现命令

```bash
node scripts/compare-cms-followup.mjs /path/to/before-dist /path/to/after-dist /tmp/comparison.json
node scripts/trace-cms-switching.mjs /path/to/after-dist /tmp/switching.json
node scripts/measure-cms-soak.mjs /path/to/after-dist /tmp/soak.json 15
node scripts/profile-cms-history.mjs /path/to/pre-sync-dist /path/to/after-dist /tmp/history.json
node scripts/analyze-cms-retainers.mjs /tmp/retainers.json /tmp/soak.json.warm.heapsnapshot.gz /tmp/soak.json.mounted-end.heapsnapshot.gz /tmp/soak.json.destroyed.heapsnapshot.gz
node scripts/qualify-cms-corpus.mjs /path/to/after-dist /tmp/corpus.json /path/to/sanitized-article.html
```

对照包含 10/100/500 KiB、多个顶层块和单容器两种结构，每版每种组合 30 个有效输入样本，交替三轮；每次下一帧测量后间隔 40 ms，并验证统计最终收敛；Source 加载并返回后再执行同样的输入采样。它与上一轮无间隔输入的数据不可混为同一实验。完整 trace 保留在 JSON 旁的 gzip 文件，时间类别有嵌套，不可直接相加。

文件校验工具在首个非空段落内部插入标记，去除该标记后比较其余 HTML 树的语义（保留文本、注释、元素与属性，只忽略属性顺序和源码位置），随后校验保存重开。文件校验工具不修改输入文件，屏蔽外部网络请求，输出路径和摘要；样本来源与脱敏情况仍需单独记录。自动文本插入不等于真实 Office 剪贴板或操作系统 IME。

## 当前证据

[基线文件清单](evidence/cms-followup-2026-09-07/baseline.json)与[基线源码](evidence/cms-followup-2026-09-07/baseline-source.tar.gz)保留了上轮结束后的未提交工作区。早期测量见[上轮报告](cms-optimization-2026-09-07.zh-CN.md)，不可替代本轮结果。

本轮完整刷新策略阶段的 `pnpm typecheck`、`pnpm test`（含构建）通过：404 项单元测试、140 项 Chromium 产品回归、16 项桌面/触屏 CMS 回归，API、258 项浏览器场景清单、打包消费者、分发与 24 个包发布产物检查通过。收窄为最终选择性策略后，Source 构建与类型检查、140 项产品回归、16 项 CMS 回归及 27 项 Source 专项重新通过。最终 Firefox/WebKit 矩阵 138 项通过、4 项按原有 Chromium 专用条件跳过，包含新补充的全局分发产物检查；Source 三引擎专项 27 项通过。日志见 [完整测试](evidence/cms-followup-2026-09-07/validation.txt)、[跨浏览器](evidence/cms-followup-2026-09-07/cross-browser.txt)、[Source](evidence/cms-followup-2026-09-07/source.txt)。最终格式、文档与 API 检查日志一并归档。初跑期间发生重载的矩阵不计入通过证据，没有调整超时、断言或预算。

[完整刷新策略的 15 分钟连续会话](evidence/cms-followup-2026-09-07/full-sync/soak.json)完成 561 轮，未发生页面异常、正文/历史/视图往返差异。挂载检查点监听器均为 152；销毁后降至 52，节点降至 287。[该阶段堆引用分析](evidence/cms-followup-2026-09-07/full-sync/retainers.json)记录的挂载结束旧 DOM 的样本根路径指向浏览器原生撤销栈；销毁后仍有 71 个 detached 节点及 1 个形似历史条目的对象，可沿路径追溯到夹具/DevTools 保留的包装实例与 UI。SoEditor 历史上限为 100 条，本轮挂载结束检测到 101 个带 beforeSource/afterSource 字段的对象；该启发式计数不等于历史栈恰好有 101 条。不能把此结果称为完全零保留。

长会话期间宿主还执行了构建/自动测试，它用于行为与保留对象诊断，循环数量不是受控吞吐率对照。初末各 20 轮撤销平均约 247/397 ms，仍有残余成本；未再出现第一轮几十秒级的累积退化。独立历史与输入对照在其它测试结束后采集，具体数值见下文最终测量。

人工检查继续使用[真实设备与素材验收表](cms-manual-qualification.zh-CN.md)。

最终选择性策略的 [5 分钟回归](evidence/cms-followup-2026-09-07/soak.json)完成 194 轮（含快照共 305.4 秒），无页面异常或正文差异；挂载监听器保持 152，销毁后为 52，节点为 287。最终加载测量重新构建的夹具与该持续会话使用的夹具逐文件 SHA-256 完全一致。5 分钟回归不替代完整刷新阶段的 15 分钟诊断，也不等于最终版本通过了 60 分钟人工会话。

## 最终同机测量

[完整对照数据](evidence/cms-followup-2026-09-07/comparison.json)，单位 ms，均为优化前 → 最终版本。输入时间是 beforeinput 到下一动画帧，不是完整后台工作耗时。

| 结构   | 正文规模 | 输入中位数   | 输入 P95      | Source 后输入中位数 | 重复进入 Source 中位数 |
| ------ | -------- | ------------ | ------------- | ------------------- | ---------------------- |
| 多块   | 10 KiB   | 7.3 → 7.7    | 13.7 → 17.2   | 15.1 → 15.6         | 27.0 → 25.7            |
| 多块   | 100 KiB  | 18.7 → 12.2  | 35.1 → 23.9   | 46.0 → 38.6         | 46.3 → 46.7            |
| 多块   | 500 KiB  | 93.0 → 57.3  | 111.8 → 70.8  | 226.6 → 217.6       | 162.9 → 132.9          |
| 单容器 | 10 KiB   | 11.0 → 8.5   | 17.5 → 15.1   | 17.6 → 14.2         | 24.2 → 21.8            |
| 单容器 | 100 KiB  | 51.5 → 26.4  | 62.4 → 36.4   | 77.9 → 47.2         | 53.1 → 47.5            |
| 单容器 | 500 KiB  | 213.9 → 92.6 | 268.6 → 139.5 | 450.0 → 212.1       | 162.4 → 135.4          |

500 KiB 单容器的输入中位数下降约 57%，Source 后输入下降约 53%；多块文档输入中位数下降约 38%。小文档没有普遍加速，10 KiB 多块结果为 7.3 → 7.7 ms，Source 后为 15.1 → 15.6 ms。500 KiB Source 后输入仍超过 200 ms，不能称为所有大文档流畅。

[Source 历史独立探针](evidence/cms-followup-2026-09-07/history-scaling.json)隔离同步策略：12 轮 100 KiB 操作，原增量同步撤销的初末三轮均值为 205.3/652.9 ms，最终策略为 156.9/129.7 ms。此短探针支持消除该场景累积退化，不证明任意长会话均无性能增长。

[最终切换 trace](evidence/cms-followup-2026-09-07/after-trace.json)的 Layout 为 54 次、481.2 ms，基线为 54 次、575.7 ms；UpdateLayoutTree 为 60 次、790.1 ms，基线为 60 次、855.9 ms。次数没有减少，不能把耗时下降表述为消除了布局。

[最终加载预算](evidence/cms-followup-2026-09-07/loading.json)与严格脚本策略下的加载失败重试通过。CMS 全局 JS 为 478,126 raw / 147,595 gzip 字节，相对基线减少 3,512 raw / 69 gzip 字节；CSS 保持 24,881 字节。压缩传输收益很小，不能将 raw 降幅当成 gzip 收益，预算未放宽。简繁译文逐键等价检查通过。

[最终堆引用分析](evidence/cms-followup-2026-09-07/retainers.json)显示挂载结束 3,881 个 detached 节点、销毁后 69 个，形似历史条目的对象由 101 个降到 1 个，并保留完整根路径；启发式计数不等于支配树保留大小，WeakMap 内部边也不能简单解释成强引用泄漏。[合成素材往返](evidence/cms-followup-2026-09-07/synthetic-corpus.json)通过，真实素材、真实 Office 剪贴板与设备验收仍未完成。

## 归档与复核

[最终工作区摘要](evidence/cms-followup-2026-09-07/final-worktree.json)对应[源码归档](evidence/cms-followup-2026-09-07/final-source.tar.gz)及[四阶段测量构建](evidence/cms-followup-2026-09-07/measurement-builds.tar.gz)。基线、初始优化、完整刷新和最终选择性策略分别保留，避免用中间结果替代最终验收。现有未提交工作保留，未提交或发布新版本。
