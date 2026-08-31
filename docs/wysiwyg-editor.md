# SoEditor WYSIWYG HTML 编辑器规范

## 状态与优先级

本文档是 SoEditor 所见即所得 HTML 编辑器的规范性文档，也是后续功能
规划、实现、演示和验收的唯一功能清单。

当本文档与旧的 Phase 3 Developer Visual、历史 CMS 演示说明或测试名称冲突
时，以本文档、ADR 0036、ADR 0037 和当前 `ROADMAP.md` 为准。旧功能存在不
代表 WYSIWYG 功能已经完成；只有 WYSIWYG 专属验收全部通过后才能标记完成。

本文档中的 “WYSIWYG” 专指普通内容作者使用的 HTML 所见即所得编辑器，
不是 Developer Visual 的别名。

逐项状态和证据记录在
[`wysiwyg-capability-matrix.md`](wysiwyg-capability-matrix.md)。

## 1. 产品定义

WYSIWYG 的目标是让用户在接近最终网页内容的画面中，直接完成日常 CMS
内容编辑：输入、选择、格式化、列表、链接、图片、文件、表格、粘贴和内容
对象操作。用户不应看见 HTML 标签、`Edit HTML`、未知节点属性清单、节点
边界按钮或开发者诊断装饰。

“所见即所得”在 SoEditor 中表示：

- 标准安全 HTML 使用标准 HTML 元素展示和编辑；
- 光标、文字选择、拖选和输入符合浏览器及成熟编辑器的常规行为；
- 内容样式可以配置，但编辑器 chrome 样式不能改变保存内容；
- 工具操作必须立即在 WYSIWYG 中可见，并同步到 canonical HTML；
- 保存 HTML 再加载后，语义和受支持功能必须保持一致；
- 不能安全执行或不能直接编辑的 HTML 仍可保留，但不得伪装成普通可编辑内容。

WYSIWYG 不是网页设计器、电子表格、任意脚本运行环境或 Developer Visual。

## 2. 与其他编辑模式的硬边界

| 模式                        | 主要用户        | 主要职责                                     | 不得出现                              |
| --------------------------- | --------------- | -------------------------------------------- | ------------------------------------- |
| WYSIWYG                     | 内容作者        | 日常富文本与 CMS 内容编辑                    | 标签源码、`Edit HTML`、开发者占位控件 |
| Developer Visual (`visual`) | HTML/CMS 开发者 | 检查保留节点、开发者导航和受控结构编辑       | 假装成普通作者模式                    |
| Source                      | HTML 开发者     | CodeMirror HTML 源码编辑、格式化、压缩、诊断 | WYSIWYG 内联格式工具                  |
| Preview                     | 内容审核者      | 在隔离模板中渲染最终内容                     | 编辑能力和写权限                      |

硬性约定：

1. `@soeditor/wysiwyg` 不得实例化、包装或委托 Developer Visual 引擎、编辑
   模型、DOM projection 或 node-view registry。
2. 仅为 WYSIWYG 服务的选择、输入、表格、媒体和粘贴行为不得加入
   Developer Visual。
3. 两者可以共享 Core、命令、事务、HTML parser、服务接口和纯数据规则，
   但不能共享带有某一种编辑表面假设的 DOM 行为。
4. WYSIWYG、Developer Visual、Source 同时可见时仍只有一个 writer。
5. `document.format` 和 `document.minify` 是 Source 全文操作，不是 WYSIWYG
   格式工具。
6. Developer Visual 的历史测试不能作为 WYSIWYG 完成证据。

## 3. 外部产品学习规则

SoEditor 独立实现，不复制其他编辑器源码、内部 API 或数据模型。参考顺序是：

1. HTML 标准、浏览器原生编辑/Selection 行为和 SoEditor 安全约束；
2. CKEditor 5 的交互和功能组织；
3. CKEditor 4、TinyMCE 8、Jodit 4 中已证明成熟的 CMS 工作流；
4. SoEditor 自己的 HTML-first、plugin-first、command-driven 架构。

当不知道如何选择交互时，默认研究并采用 CKEditor 5 的用户体验原则，然后
根据 SoEditor HTML-first 保存规则独立设计实现。不能仅凭截图猜测行为；应
查看官方文档、运行官方演示，并把观察转换为可执行验收测试。

### 3.1 主要参考优点

CKEditor 5 是默认参考：

- 编辑视图与输出数据职责分离；
- 命令、插件、conversion 和 contextual toolbar 分工明确；
- 表格单元格支持普通 block/inline 内容、矩形选择和单一上下文工具栏；
- 链接、图片、表格使用贴近目标的 balloon 工具；
- 粘贴、上传、文件管理和 Source 都有明确的能力边界；
- 可访问键盘帮助、状态和复杂内容交互较完整。

CKEditor 4 主要参考：

- 传统 CMS 中无需重新构建即可配置工具栏、插件、内容 CSS 和对话框；
- 图片、链接、表格属性对话框覆盖完整；
- 外部粘贴过滤、文件浏览器和上传适配经验成熟；
- Source 与经典 textarea/form 集成直观。

TinyMCE 8 主要参考：

- 表格插件同时提供上下文工具栏、菜单、右键菜单和属性对话框；
- 图片上传、blob/data、URL 与 host 回调边界清晰；
- 对话框组件、配置项和插件开关成熟；
- 内容 CSS、预览和源码插件边界清楚。

Jodit 4 主要参考：

- 轻量直接的 WYSIWYG 交互；
- 图片/文件的 URL、上传、文件浏览器组合入口；
- 选择 API 与可配置 toolbar/plugin 组合；
- 可替换 uploader/file browser 后端。

### 3.2 官方参考

- [CKEditor 5 editing engine](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)
- [CKEditor 5 feature overview](https://ckeditor.com/docs/ckeditor5/latest/features/index.html)
- [CKEditor 5 tables](https://ckeditor.com/docs/ckeditor5/latest/features/tables/tables.html)
- [CKEditor 5 links](https://ckeditor.com/docs/ckeditor5/latest/features/link.html)
- [CKEditor 5 image upload](https://ckeditor.com/docs/ckeditor5/latest/features/images/image-upload/image-upload.html)
- [CKEditor 5 General HTML Support](https://ckeditor.com/docs/ckeditor5/latest/features/html/general-html-support.html)
- [CKEditor 5 Source editing](https://ckeditor.com/docs/ckeditor5/latest/features/source-editing/source-editing.html)
- [CKEditor 4 feature overview](https://ckeditor.com/docs/ckeditor4/latest/features/index.html)
- [CKEditor 4 dropping and pasting](https://ckeditor.com/docs/ckeditor4/latest/features/drop_paste.html)
- [TinyMCE table plugin](https://www.tiny.cloud/docs/tinymce/latest/table/)
- [TinyMCE image upload](https://www.tiny.cloud/docs/tinymce/latest/upload-images/)
- [Jodit selection](https://xdsoft.net/jodit/docs/modules/selection.html)
- [Jodit uploader](https://xdsoft.net/jodit/docs/modules/uploader.html)
- [Jodit file browser](https://xdsoft.net/jodit/docs/modules/file_browser.html)

## 4. WYSIWYG 核心交互约定

### 4.1 原生编辑感

- 单击文字应把光标放在命中的字符边界，不得固定跳到开头或结尾。
- 鼠标拖动应能选择任意连续文字，包括表格单元格内文字。
- 双击遵循平台选词规则；三击和块选择不得破坏 HTML 结构。
- 工具栏获得焦点后必须保留最后的有效编辑选择。
- 选择保存必须使用明确的编辑选区会话，不能根据 `activeElement` 或一次
  `selectionchange` 猜测用户意图。指针或键盘进入工具栏、菜单、balloon、
  dialog 后立即冻结进入前的 selection bookmark；弹层内任何输入、选色、
  选择、校验和异步操作都不得覆盖该 bookmark。
- 浏览器因焦点转移补发的 `selectionchange` 不是作者建立的新选区。只有用户
  回到 WYSIWYG 内容表面并产生明确编辑意图时，才结束冻结并接受新选区。
- 浏览器和 Shadow DOM 返回的 `Selection`/`Range` 是不可信边界输入；调用
  `contains()`、读取父节点或保存范围前必须验证 Range 和
  `commonAncestorContainer` 确实属于当前 document 的 DOM 类型。畸形、过期或
  跨上下文范围只能忽略并回退到最后有效书签，不能让 `selectionchange` 抛出
  未捕获异常。
- 所有 command-backed 弹层动作必须在执行命令前恢复冻结选区；动作校验失败
  或异步动作仍停留在弹层时必须继续同一会话。不得为颜色、字体、链接、图片
  或表格分别实现互不一致的选区补丁。
- 冻结选区的可视提示只能使用不进入内容 DOM、不会写入 canonical HTML 的
  UI 投影；不得把 CSS Custom Highlight API 当作唯一实现，因为浏览器和
  Shadow DOM 支持并不一致。销毁、模式切换、新正文选择、滚动和缩放必须正确
  更新或清理该投影。
- 单击另一个可写 pane 可请求切换 writer，但不能重置点击位置。
- 中文 IME、emoji、组合字符和 RTL 输入必须作为一等输入路径验证。
- 浏览器原生输入不能绕过事务；事务提交也不能在每次输入后重建 DOM 并
  丢失选择。

### 4.2 工具栏与上下文 UI

- 主工具栏只放通用内容命令。
- 表格结构工具只在当前表格上方或附近出现，一个表格同一时间只有一个
  contextual toolbar。
- 图片、链接和媒体使用目标上下文 balloon 或属性对话框。
- 上下文工具不能插入到内容 DOM，不能占据单元格编辑位置。
- 工具状态必须反映当前选择，不能沿用上一次无关选择状态。
- 任何操作失败都要显示可理解的错误，不能静默无效。
- 工具通过 command/service 执行，不能直接成为保存数据的隐藏来源。

### 4.3 内容样式

- WYSIWYG authoring DOM 必须与编辑器所在网页的 CSS 隔离；宿主 reset、主题和
  `!important` 规则不能改变内容的语义呈现。
- Browser default 的内容样式表为空，直接使用浏览器 UA stylesheet。不得用一套
  SoEditor CSS 去模拟浏览器默认值；因此 `strong`、`em`、标题、段落、列表、链接、
  上下标和预格式化文本保持浏览器本来的区别，HTML 内联样式仍可显式覆盖。
- 可切换 Browser default、Article、Email 和 host-defined presets。
- 其他预设与 host-defined preset 都从相同的隔离空白基线开始，仅追加自己的 CSS。
  预设只改变编辑显示；除非用户执行内容格式命令，否则不能写入 HTML。
- `blockquote`、`th` 等元素在 Browser default 中不得被强制加入品牌色。

## 5. HTML 与安全规则

WYSIWYG 对输入 HTML 必须区分：

1. 标准且可编辑；
2. 标准但当前只读或受限；
3. 未知但应保留；
4. 无效；
5. 危险且不得执行。

标准安全元素尽量使用真实 HTML DOM。未知元素、注释、模板、脚本、iframe
和危险属性不能在 authoring DOM 中执行。它们可以通过不可执行映射保留到
canonical HTML，但展示策略必须配置，并且不能阻挡用户继续编辑前后内容。

WYSIWYG 不承诺 byte-for-byte 保存；承诺经过明确规则的语义保存。清理行为
必须由配置、粘贴策略或显式命令触发，不能因为 visual feature 不认识内容
就静默删除。

## 6. 功能完整性定义

一个功能只有同时满足下列条件才能标记 `Complete`：

1. 有独立 plugin 或明确的跨功能基础设施所有者；
2. 有 command/service API，toolbar 不是唯一入口；
3. 鼠标、键盘和必要的触摸行为可用；
4. collapsed caret、单选区、跨 inline、跨 block 等适用选择场景通过；
5. WYSIWYG 中变化立即可见；
6. canonical HTML 同步且 undo/redo 正确；
7. Source 修改后返回 WYSIWYG 仍正确；
8. readonly、disabled、destroy 和多实例隔离通过；
9. 中文 IME、移动端、RTL、缩放和可访问性按风险验证；
10. 安全输入不执行，未知 HTML 不无故丢失；
11. 至少有一个从真实 UI 操作的 Chromium 测试，而不是只直接执行 command；
12. 对关键交互至少完成 Firefox/WebKit 验证；环境无法运行时必须明确记录，
    不能将 Chromium 通过写成跨浏览器完成。
13. 凡是包含工具栏菜单、balloon 或 dialog 的功能，必须验证真实点击输入控件、
    浏览器焦点副作用、取消、校验失败、连续重复应用和返回正文建立新选区；只用
    脚本直接执行 command 不能证明选区生命周期完整。

以下证据不能单独证明完成：

- 按钮出现；
- command 单元测试通过；
- Source 中出现新属性；
- Developer Visual 测试通过；
- 截图看起来正确；
- 只验证了一个空段落或第一个表格单元格。

## 7. 功能验收清单

每个条目使用 `Not started | In progress | Verified | Blocked`，禁止使用含糊的
“基本完成”。当前实现须从 `In progress` 重新审计，不能继承旧阶段的
`delivered` 标签。

### 7.1 编辑基础（P0）

- 任意位置 caret、拖选、双击选词、Shift 扩展选择；
- 输入、替换、Enter、Shift+Enter、Backspace、Delete；
- 中文 IME、emoji、组合字符、RTL；
- clipboard copy/cut/paste 与内部语义 MIME；
- undo/redo 分组和选择恢复；
- focus、toolbar/dialog selection bookmark；
- readonly、多实例、销毁和异常恢复。

### 7.2 文本与块格式（P0）

- bold、italic、underline、strike、subscript、superscript；
- text color、background color、font size、remove format；
- 清除文字颜色、背景色或 highlight 必须删除对应 CSS declaration；不得用
  `inherit`、`transparent` 等新值伪装成清除。删除最后一个声明后必须移除空
  `style` 和无语义 `span`，同时保留同一节点上的其他字体样式。
- paragraph、heading、blockquote、pre/code；
- alignment、indent/outdent、horizontal rule；
- 多段选择、混合状态、列表项和表格单元格内格式；
- 格式状态不能泄漏到下一次无关选择。

### 7.3 列表（P0）

- unordered/ordered list、start、marker type；
- Enter 拆分、空项退出、Backspace 合并；
- Tab/Shift+Tab 嵌套与反嵌套；
- 多层复制粘贴和 Office list；
- 在 list item 内格式化不得多生成 `<li>`。

### 7.4 链接和锚点（P0）

- 选中文字自动填入 Displayed text；
- collapsed caret 插入链接；
- 点击已有链接可查看、编辑和 unlink；
- `Ctrl/Cmd+K`、键盘关闭与焦点恢复；
- URL、target、rel、download、内部内容和文件选择；target 必须同时提供常用
  browsing-context 选项和受校验的自定义名称；rel 使用可增删的 token 控件，支持
  常用关系选择和合法扩展 token，并为 `_blank` 自动补充隔离关系；
- 链接边界输入、相邻链接和图片链接；
- named anchor 使用一致图标和非破坏性可见标记。

### 7.5 表格（P0，独立阻断门）

表格未通过本节全部核心场景前，WYSIWYG 不得宣称可用于生产 CMS。

- 单击任意单元格文字的任意字符边界，caret 必须精确命中；
- 鼠标可在一个单元格内拖选，也可按明确交互选择矩形单元格区域；
- 单元格内允许段落、标题、列表、链接、图片及普通 inline 格式；
- 单元格编辑与正文使用同一主格式工具，不提供重复的 cell bold/link/image；
- 表格 contextual toolbar 只出现一个，优先放在表格上方；不可见时自动翻转
  或限制在 viewport 内，不插入内容 DOM；
- 插入/删除行列、表头行列、merge/split、caption、表格/行/单元格属性；
- 表格宽度、列宽、对齐、行高和单元格对齐必须立即可见并写入规范 HTML；
- 属性对话框读取当前值，Apply 后保留所选表格位置，Cancel 不改内容；
- copy/cut/paste 单格与矩形区域，Office 表格清理，多层内容保留；
- Tab/Shift+Tab 导航、边界新增行策略、方向键和 screen reader 语义；
- undo/redo 每次结构操作为可预测的一步；
- `thead/tbody/tfoot/caption/colgroup/rowspan/colspan/scope` round-trip；
- 不支持的表结构应保留并明确限制，不能静默改坏。

### 7.6 图片、文件、媒体（P0/P1）

- 一个图片下拉入口：本地上传、文件管理器、URL；
- paste/drop 图片可配置为自动上传、data URL 或拒绝；
- upload progress、cancel、retry、失败恢复和离开保护；
- 双击图片打开属性；alt、title、caption、尺寸、比例锁定、对齐、链接；
- 图片替换、删除、responsive sources 与安全 URL；
- 文件链接走独立 FileManager/Upload service；
- 视频在编辑态有可见边界，可播放与编辑模式明确分离；
- iframe/embed 保留、预览和执行策略分离。

### 7.7 粘贴与清理（P0）

- internal、cross-editor、web、plain text、Office、Google Docs、LibreOffice；
- 自动识别与可选 cleanup prompt；
- keep formatting、semantic clean、plain text 三种策略；
- 图片上传/data/reject 策略；
- 表格单元格内 rich paste 与矩阵 paste；
- 清理报告可查看，撤销为一步；
- 可选安全强度和显式“清理当前 HTML”命令。

### 7.8 Source、Preview 与布局（P0/P1）

- 七种明确布局：WYSIWYG、Source、WYSIWYG+Source、WYSIWYG+Preview、
  Source+Preview、WYSIWYG+Source+Preview、Preview；
- 单击/双击 pane 激活 writer 的规则明确，图标显示切换目标；
- Source 使用 CodeMirror，支持 format、minify、find/replace 和诊断；
- Preview 使用 sandboxed iframe、内容 CSS、自定义模板和客户端预设；
- maximize + Preview 代替重复的 Preview Fullscreen；
- 多 pane 同步不应打断输入；位置同步是可关闭的 best effort 增强项。

### 7.9 内容对象和特殊 HTML（P1）

- 特殊字符有可关闭的预设选择器；
- comment、custom element、CMS marker 有可配置的安全展示方式；
- 占位展示不得阻断在其前后继续输入；
- `aside` 等标准元素按标准 HTML 展示；
- script/iframe/event attributes 不在 authoring DOM 执行；
- email 模式、优化建议、转换和客户端模拟单独规划，不混入基础 P0。

## 8. 逐功能实施与验证流程

每次只推进一个可清晰验收的 feature slice：

1. 写出目标用户动作和失败示例；
2. 查看 CKEditor 5 官方演示和文档；必要时对照其他三款编辑器；
3. 记录采用的交互、未采用的交互及原因；
4. 定义 command/service、HTML 输入输出和安全边界；
5. 先写真实 UI 浏览器测试，再实现；
6. 同时验证段落、列表项和表格单元格，避免局部特例；
7. 验证 Source round-trip、undo/redo、readonly 和销毁；
8. 更新本清单的证据链接；
9. 运行相关测试和全仓验证；
10. 只有所有验收维度通过才标记 `Verified`。

禁止用一个不断扩大的 `classic-editor.ts` 直接堆 UI 特例。上下文 UI 可由
Classic 装配，但 WYSIWYG 行为和状态必须由 WYSIWYG package 或专用 plugin
拥有。

## 9. 测试与演示约定

WYSIWYG 应有独立测试目录和能力矩阵。测试最少覆盖：

- 用户真实点击、键盘、拖动和输入；
- 选择起点、中间、终点及反向 selection；
- paragraph、nested list item、不同表格单元格；
- Chrome/Firefox/WebKit 桌面，关键路径移动 viewport；
- 中文 IME、RTL、150%/200% zoom、forced colors；
- WYSIWYG-only 和所有含 WYSIWYG 的组合布局；
- canonical HTML、可见 DOM 与 Preview 三方结果；
- 安全、性能、内存、生命周期和多实例隔离。

根演示必须直接展示本清单中已经 `Verified` 的功能。未完成能力不得用静态
文案标成“完成”。每一个主要功能要有可重复的示例内容和明确操作入口。

## 10. 当前基线声明

仓库已有独立 native-DOM WYSIWYG、基础格式、七种布局、Source、Preview、
上传/文件管理服务和部分表格能力。这些是重新验收的实现基线，不是自动继承
的完成结论。

下一阶段按 `ROADMAP.md` 的 WYSIWYG completion program 顺序执行。优先级是
选择与输入正确性、正文格式一致性、表格完整性、媒体/粘贴，然后才是高级
内容对象和 Email 增强。
