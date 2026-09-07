# CMS 正确性与素材基线（2026-09-08）

本轮落实正文统计、日常操作回归、工具栏完整性、前台图片对齐和文章性能基线。真实文章与实际设备尚未提供；合成素材不代表真实素材验收。

## 正文统计口径

统计由 `packages/ui/src/document-statistics.ts` 负责，在脱离页面的 HTML 片段上遍历，不读取布局或 CSS 计算样式，不改写 canonical HTML。

- 字符数按 Unicode 码点计算，emoji 的代理对算一个，组合附加符号仍单独计数。
- 普通文本中的 HTML 空白压缩，块边界的空白不计；段落、换行和表格单元格是词的边界，不额外算一个字符。`pre` 内保留空白；纯空白内容仍计零。
- 中文汉字、日文假名逐字计一个单位；其他文字和数字按连续词计数，保留词内撇号及组合附加符号。此“词”指标是确定性的计数单位，不是词典分词。例：`Hello世界` 为 3 词、7 字符。
- 注释、script/style/template/noscript/iframe，以及 `hidden` 或内联 `display:none` / `visibility:hidden` 的子树不计正文。
- 源码字符数独立按原始 HTML 码点计算，包含标签和空白。
- 不模拟外部样式表、伪元素、宿主业务组件和动态脚本生成内容。统计是静态正文指标，不是页面截图中的可见字符识别。

保留已有首次同步、后续约 100 ms 合并更新及销毁取消任务的策略。统计仍消耗主线程时间，不将延迟执行表述为零 CPU 成本。

## 前台图片样式

此入口已在当前工作区构建验证，尚未发布新版本。独立入口只提供图片对齐规则，与编辑区复用相同源文件，不加载编辑器 JavaScript 或 UI 样式：

```ts
import '@soeditor/editor/content.css';
```

```html
<article class="soeditor-content">
    <!-- 放置保存的正文 HTML -->
    <figure data-soeditor-media="image" data-align="center">
        <img src="/images/example.jpg" width="320" height="180" alt="示例" />
    </figure>
</article>
```

无打包器的网站可以部署包内 `dist/content.css` 并通过普通 stylesheet 链接引入。入口支持 left/center/right、带链接图片和块级图片；宿主显式覆盖规则仍由宿主负责。已增加真实构建的编辑器保存 HTML → 独立前台样式的浏览器回归。未对某个未提供的生产 CMS 页面宣称部署完成。

## 自动操作检查

保留并补强图片对齐、显示区块、嵌套列表、元素路径、Source 往返、分屏和删除流程。新检查覆盖：

- 正文统计的块边界、空白、不可见内容、中文与纯空正文；
- 键盘全选删除后正文统计为零，上下分屏后仍为零；
- Classic 声明的工具栏项目均存在且具有标签，显示区块可用键盘切换，中文页面本地化正确；
- 保存后的图片 HTML 在不加载编辑器的前台容器中正确对齐。

## 文章基线

`scripts/measure-cms-corpus.mjs` 接受来源清单，每篇执行三个新实例，记录启动、输入到下一帧、选区移动、Source/两种分屏切换和表格选取。记录素材 SHA-256、构建文件 SHA-256、浏览器、平台与视口；选区及表格计时包含浏览器协议开销。外部请求屏蔽并记录，不能将缺失远程资源的结果当作完整线上加载效果。

```bash
node scripts/measure-cms-loading.mjs /tmp/loading.json --build-only
node scripts/measure-cms-corpus.mjs node_modules/.cache/soeditor-cms-loading/dist tests/fixtures/cms/performance/manifest.json /tmp/corpus-performance.json
node scripts/qualify-cms-corpus.mjs node_modules/.cache/soeditor-cms-loading/dist /tmp/corpus-roundtrip.json /path/to/anonymized-article.html
```

清单格式：

```json
{
    "samples": [
        {
            "path": "article.html",
            "kind": "real-anonymized",
            "provenance": "填写来源 CMS、脱敏说明及采样日期"
        }
    ]
}
```

相对路径以清单目录为基准。仓库内长文章、图片列表、复杂表格明确标记为 `synthetic`。真实文章及设备验收保留待办，收到素材后使用同一工具测量；只有环境、素材摘要和测量协议一致的数据才能直接比较。

## 本轮合成基线

在其它本轮重型测试结束后独立采集，每类 3 个实例、30 个有效输入样本，单位 ms。输入从编辑表面捕获阶段的 beforeinput 起计至下一动画帧；选区数据包含浏览器协议开销，不与旧脚本不同计时点的数据直接比较。

| 样本             | HTML 大小 | 输入中位数 | 输入 P95 | 选区中位数 |
| ---------------- | --------- | ---------- | -------- | ---------- |
| 长文章（合成）   | 125.1 KiB | 14.2       | 25.0     | 14.0       |
| 图片列表（合成） | 29.0 KiB  | 8.5        | 14.9     | 14.0       |
| 复杂表格（合成） | 314.1 KiB | 36.8       | 47.0     | 22.2       |

复杂表格仍超过 16.7 ms 的单帧时间，基线不是“所有文档流畅”的认证。四份合成素材（含既有 legacy-product）均通过修改、Source 往返、保存和重开检查。

冻结加载与失败恢复预算已通过。默认全局 JS 为 480,733 raw / 148,462 gzip 字节，独立 UI CSS 为 24,935 raw 字节；新增前台内容 CSS 为 812 raw 字节，显式导入，无编辑器 JS 依赖。

## 验收证据与剩余工作

完整类型检查、构建及 `pnpm test` 通过：406 项单元测试、145 项 Chromium 产品回归、16 项 CMS 桌面/触屏回归。API、263 项浏览器场景清单、打包消费者、分发及 24 个包发布产物检查通过。Firefox/WebKit 完整矩阵 148 项通过、4 项按原有 Chromium 专用条件跳过。

- [完整测试日志](evidence/cms-followup-2026-09-08/validation.txt)
- [类型检查](evidence/cms-followup-2026-09-08/typecheck.txt)
- [跨浏览器矩阵](evidence/cms-followup-2026-09-08/cross-browser.txt)
- [加载预算及失败恢复](evidence/cms-followup-2026-09-08/loading.json)
- [文章性能基线](evidence/cms-followup-2026-09-08/corpus-performance.json)
- [四份合成素材的保存往返](evidence/cms-followup-2026-09-08/corpus-roundtrip.json)

前四项的代码与自动验收完成；第五项的工具和合成基线完成，真实文章、真实 Office 素材及设备验收仍待提供输入。没有提交、发布或部署；当前包入口的新增能力不代表已经发布到 registry。

三浏览器 [Source 专项](evidence/cms-followup-2026-09-08/source.txt) 27 项通过。工具栏增加显式可见性断言后，Chromium 完整测试与 Firefox/WebKit [补充专项](evidence/cms-followup-2026-09-08/toolbar.txt)均通过。[lint](evidence/cms-followup-2026-09-08/lint.txt)通过。

[工作区与构建摘要](evidence/cms-followup-2026-09-08/final-worktree.json)对应[源码快照](evidence/cms-followup-2026-09-08/final-source.tar.gz)和[可复测构建](evidence/cms-followup-2026-09-08/measurement-build.tar.gz)。解压后使用 `measurement-dist` 作为性能脚本第一个参数；归档中的 `distribution` 同时保留本轮全局构建与前台 CSS。
