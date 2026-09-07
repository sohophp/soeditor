# 大文档性能跟进

> 2026-09-07：当前工作区的优化状态、测量与验证统一见 [CMS 性能与稳定性优化](cms-optimization-2026-09-07.zh-CN.md)。以下日期更早的数字为历史记录；人工设备验收单独列出。

## 范围（2026-09-05）

在 [WS1–WS6](wysiwyg-source-evidence.zh-CN.md) 完成后，继续处理已测出的
500 KiB CMS HTML 输入成本。本次只优化状态栏统计；HTML 保存、WYSIWYG
序列化、Source 加载边界和公开 API 保持原有契约。

## 实现

状态栏原来在选择、命令和状态刷新时，都重新创建 inert template、解析整篇
HTML 并计算字数。现在每个 UI 实例仅保存最近一次完整源码及统计结果：

- 完整内容相等时复用统计，元素路径、模式和翻译仍读取当前状态；
- 内容改变时同步重新计算，等长替换也会失效，不依赖 dirty 或源码长度；
- 撤销、Source 输入、API setData 使用同一规则；
- 销毁时释放缓存，不引入全局缓存、定时器或运行时依赖。

缓存保留一个源码字符串引用和三个计数，不保留 template DOM。未开启状态栏
统计的实例不会计算。此优化不减少每次真实内容变化所需的一次完整统计。

## 测量方法与结果

[原始连续输入数据](evidence/large-document-input-comparison.json)保留每个样本。
使用相同依赖和夹具的两份生产模式诊断构建，均关闭压缩、开启 sourcemap。
夹具来自 `scripts/measure-cms-loading.mjs`，包含段落、链接、表格、注释和
未知 CMS 元素，文档目标大小为 500 KiB，Source 关闭。

Chromium 中交替运行前后版本，每版三个新页面／实例；每个实例先输入一次
预热，再测六次原生文本输入，从 `beforeinput` 到下一次 animation frame。
每版共 18 个有效样本，中位数为 **214.7 → 198.3 ms**，本次样本减少约
**16.4 ms / 7.7%**。测试期间没有并行构建或其他测试；不是正式压缩产物的
发布延迟，也不是跨机器 P95 或每次输入的改善承诺。

复测两份已保存夹具构建：

```bash
node scripts/compare-cms-input.mjs /path/to/before-dist /path/to/after-dist /tmp/input-comparison.json
```

两份构建必须来自相同夹具和构建设置，并在改动前后分别保存，不能把旧版本
默认功能更多的入口当作本次缓存改动的基线。本机原始快照位于
`/tmp/soeditor-large-doc/before/`，临时目录不构成持久发布证据。

独立 CDP CPU 采样中的五次输入，统计相关函数 self time 从约 531.9 ms
降为 182.6 ms；这是定位重复工作的诊断证据，不与上述 18 次样本混算。
序列化仍占明显时间，不能称为大文档延迟已经解决。

### 正式压缩构建补测

[当前加载与交互数据](evidence/large-document-current.json)由以下命令独立生成：

```bash
node scripts/measure-cms-loading.mjs docs/evidence/large-document-current.json --recovery --interactions
```

CMS 全局 JS 为 **477346 raw / 147258 gzip 字节**，相对 WS6 增加
**149 / 34 字节**；CMS CSS 仍为 26778 / 4896 字节。增加少量缓存代码换取
上述已测重复统计成本下降，既有体积、可选加载图和 Source 切换预算全部通过，
没有提高上限。打包 CMS 消费者为 436790 / 141541 字节。

下表为热创建后的 WYSIWYG 单次样本，单位 ms；Source 开启表示已配置，
交互时尚未首次激活。粘贴使用合成 ClipboardEvent，含文本和图片 HTML。

| 文档    | Source 配置 |  输入 |  粘贴 |  表格 |
| ------- | ----------- | ----: | ----: | ----: |
| 10 KiB  | 关闭        |  11.7 |  16.0 |  14.0 |
| 10 KiB  | 开启        |  12.5 |  21.3 |  13.2 |
| 100 KiB | 关闭        |  61.8 |  59.1 |  54.8 |
| 100 KiB | 开启        |  52.9 |  60.2 |  61.9 |
| 500 KiB | 关闭        | 203.6 | 296.2 | 242.1 |
| 500 KiB | 开启        | 220.4 | 264.0 | 241.0 |

这些数据与 WS6 的历史单次样本都有波动，不能据此声称粘贴或每种配置均变快。
缓存改动的前后对比采用上面的同设置连续输入实验；压缩构建数据用于当前
功能及预算验证，两组结果不混算。

## 自动验收

- `pnpm test` 完整通过：单元、集成性能、24 个包的 API／分发／发布检查、
  文档及打包消费者、115 项产品 Chromium 和 6 项桌面／移动 CMS 测试。
- `pnpm lint` 和全工作区类型检查通过；完整测试链已重新构建产物。
- 扩展既有字数统计用例，验证等长 Source 替换、撤销、readonly 切换及
  setData、emoji、组合字符和 HTML 实体；Chromium、Firefox、WebKit
  专项三项通过。没有新增浏览器情景，文档清单仍为 233 项。
- Firefox／WebKit 使用官方 Playwright 1.62.1 Noble 容器；这是自动化引擎
  验证，不能代替真实 Safari 和屏幕阅读器人工验收。
- Winstar 本地 `resources/dist` 已重建，manifest 相对本次优化前仅更新
  SoEditor 入口记录；`pnpm tsc:check`、`pnpm build` 和六项集成测试通过。
  未修改宿主配置、发布版本或部署生产。

## 后续边界

下一步先测量序列化和更新链的重复遍历，再决定是否引入更细粒度的失效规则。
任何进一步优化都必须保持未知 HTML、撤销、表单同步和 Source 往返正确，
不以延迟保存数据或静默丢弃标记换取输入成绩。真实 Safari、IME 和辅助技术
人工验收仍与自动化结果分开记录。
