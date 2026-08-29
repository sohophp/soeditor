# SoEditor Architecture 0.1

## Phase 1 implementation status

Phase 1 implements only `@soeditor/core`, the `@soeditor/engine` package shell,
and a minimal core playground. The remainder of this document describes the
accepted long-term direction and later milestones; it is not implemented by
Phase 1.

The current `EditorMode` runtime state is `visual | source | preview`, while
`DocumentFormat` reserves `html | markdown` and only HTML can currently be
instantiated. There is no selection, history, UI, visual editing engine, source
editor, Markdown processing, diagnostics, formatting, preview renderer, or file
manager in this phase.

### Phase 1.1 stabilization policies

- `Editor` exposes narrow command, plugin, service, and event capabilities.
  Concrete registry cleanup and plugin lifecycle controls remain internal.
- Public registry capabilities reject use after destruction. Destruction is
  idempotent, shares one pending promise, and completes cleanup even when plugin
  hooks or lifecycle-event listeners fail.
- Normal event emission visits every listener and then reports listener errors.
  Mandatory lifecycle events use safe emission; failures are reported through
  `event:error` without interrupting cleanup.
- Synchronous reentrant dispatch is rejected. Transactions are editor-owned,
  single-use, and tied to the editor state version at which they were created.
- Configuration is immutable JSON-like plain data. Unsupported objects,
  functions, accessors, symbol keys, and cyclic structures are rejected.
- `readonly` is editing-policy state. Administrative `setData()` updates remain
  allowed; future user-facing editing surfaces must enforce the policy.

### Phase 1.2 hardening policies

- The first `destroy()` call publishes its shared promise before plugin cleanup
  starts, so reentrant and concurrent calls observe the same promise identity.
- `editor.events` is subscription-only. Event publication and cleanup remain
  capabilities of the internally owned event bus.
- Commands inspect a PromiseLike `then` property once. Getter failures follow
  normal `command:error` handling while synchronous results stay synchronous.
- Configuration arrays must be dense ordinary data arrays. Accessor indices,
  symbol or custom properties, unsupported values, and cycles are rejected.
- Core event listeners are synchronous. Returned promises are unsupported and
  are neither awaited nor incorporated into lifecycle sequencing.

### Phase 1.3 lifecycle finalization

- Editor lifecycle transitions are terminal: `initializing` may become `ready`
  or `destroying`, while `destroying` may only become `destroyed`.
- Destruction during plugin construction, initialization, or readiness aborts
  startup. Remaining hooks do not run and `Editor.create()` rejects with
  `EditorInitializationAbortedError` after required cleanup completes.
- Plugin lifecycle stages are advanced only while editor startup remains
  active. A hook returning after destruction began cannot resurrect a plugin.
- `editor:ready` is emitted only after guarded plugin startup completes, and a
  destroyed editor is never returned by `Editor.create()`.

### Phase 1.4 startup abort finalization

- Plugin `init()` and `ready()` waits observe both hook settlement and the
  editor's internal destruction-start signal. When destruction wins, startup
  waits only for the shared destruction operation and then rejects creation.
- Hook promises remain observed after startup aborts. Late fulfillment has no
  effect, while late rejection cannot become an unhandled rejection or replace
  the initialization-aborted result.
- Required post-commit document, mode, and state notifications are attempted
  independently. Listener errors are reported after every required notification
  has been attempted and do not roll back committed state.
- Plain configuration objects reject accessors regardless of enumerability and
  never invoke those accessors while validating.
- A plugin `destroy()` hook must not await its own editor's shared `destroy()`
  promise. The shared promise waits for that hook, so awaiting it from the hook
  would create a self-dependency; obtaining or comparing it remains allowed.

## 1. 项目定位

SoEditor 是一个面向开发者、CMS 和内容系统的现代可扩展内容编辑器。

核心定位：

**HTML-first · Plugin-first · Developer-first**

SoEditor 不试图复制 CKEditor 4，也不复制 CKEditor 5，而是结合：

- CKEditor 4 的 HTML 自由度和配置自由
- CKEditor 5 的 Plugin / Command / 分层思想
- VSCode 的 Extension / Contribution / Command Palette 思想
- CodeMirror 的源码编辑能力
- 现代 TypeScript / ESM / npm / CDN 软件包生态

SoEditor 的核心目标：

1. HTML 数据尽可能无损保存
2. 未识别 HTML 不应默认删除
3. Visual / Source / Markdown / Preview 是同一文档的不同视图
4. 所有功能优先通过 Plugin 实现
5. 所有用户操作优先通过 Command 执行
6. UI 与编辑逻辑解耦
7. 支持 npm、ESM、CDN
8. Framework Agnostic
9. 第三方开发者无需修改 Core 即可扩展功能
10. Core 保持小型、稳定、可测试

---

# 2. 非目标

SoEditor 0.x 不实现：

- 实时多人协作
- Comments
- Track Changes
- Office 文档兼容
- Word 分页排版
- 自研代码编辑器
- 自研完整 HTML Parser
- 自研 Markdown Parser
- AI 编辑
- 复杂 Spreadsheet
- 完整 Browser Layout Engine

这些功能未来可以通过 Plugin 或独立 Package 增加。

---

# 3. 总体架构

```text
┌─────────────────────────────────────────────┐
│                  SoEditor                   │
├─────────────────────────────────────────────┤
│ UI                                          │
│ Toolbar / Menu / Dialog / Context Menu      │
│ Command Palette / Status Bar                │
├─────────────────────────────────────────────┤
│ Extensions                                  │
│ Plugins / Contributions / Presets           │
├─────────────────────────────────────────────┤
│ Commands                                    │
│ execute() / queryState() / canExecute()      │
├─────────────────────────────────────────────┤
│ Editor Core                                 │
│ Editor / State / Transaction / Selection    │
├─────────────────────────────────────────────┤
│ Document                                    │
│ HTML / Markdown / Metadata                  │
├─────────────────────────────────────────────┤
│ Editing Surfaces                            │
│ Visual / Source / Markdown / Preview        │
├─────────────────────────────────────────────┤
│ Services                                    │
│ Parser / Serializer / Diagnostics / Format  │
├─────────────────────────────────────────────┤
│ Platform                                    │
│ Browser / DOM / Clipboard / Storage         │
└─────────────────────────────────────────────┘
```

---

# 4. Monorepo

使用：

```text
pnpm
TypeScript
Vite
Vitest
ESLint
Prettier
Changesets
```

项目：

```text
soeditor/
│
├─ apps/
│  ├─ playground/
│  └─ docs/
│
├─ packages/
│  ├─ core/
│  ├─ engine/
│  ├─ ui/
│  ├─ html/
│  ├─ markdown/
│  ├─ source/
│  ├─ preview/
│  ├─ diagnostics/
│  ├─ formatter/
│  └─ icons/
│
├─ plugins/
│  ├─ essentials/
│  ├─ basic-styles/
│  ├─ heading/
│  ├─ link/
│  ├─ list/
│  ├─ blockquote/
│  ├─ image/
│  ├─ table/
│  ├─ code/
│  ├─ source-editing/
│  ├─ markdown/
│  ├─ preview/
│  └─ html-diagnostics/
│
├─ presets/
│  ├─ classic/
│  ├─ minimal/
│  ├─ developer/
│  └─ markdown/
│
├─ tests/
│
├─ docs/
│  ├─ architecture.md
│  ├─ plugin-api.md
│  ├─ command-api.md
│  └─ security.md
│
└─ package.json
```

---

# 5. Core 原则

`@soeditor/core` 不允许依赖：

```text
CodeMirror
Prettier
Markdown parser
具体 Toolbar
Image
Table
React
Vue
```

Core 只能包含：

```text
Editor
EditorState
Transaction
CommandRegistry
PluginManager
ServiceRegistry
EventBus
Configuration
Lifecycle
```

Core 必须能够独立运行。

---

# 6. Editor

Editor 是整个系统的入口。

```ts
export interface EditorOptions {
    data?: string
    format?: DocumentFormat

    plugins?: PluginConstructor[]

    config?: EditorConfig
}

export class Editor {
    readonly commands: CommandRegistry
    readonly plugins: PluginManager
    readonly services: ServiceRegistry
    readonly events: EventBus

    get state(): EditorState

    execute(
        command: string,
        ...args: unknown[]
    ): unknown

    update(
        callback: (transaction: Transaction) => void
    ): void

    getData(): string

    setData(data: string): void

    destroy(): Promise<void>
}
```

Editor 本身不能包含：

```text
bold()
insertImage()
insertTable()
```

这些全部属于插件。

---

# 7. Document

这是最关键的架构决定。

SoEditor 不采用 CKEditor 5 那样完全与 HTML 分离的严格语义 Model。

但也不能简单把一个 HTML string 当作全部状态。

推荐：

```ts
export interface EditorDocument {
    format: DocumentFormat

    source: string

    revision: number

    metadata: Record<string, unknown>
}
```

其中：

```ts
type DocumentFormat =
    | 'html'
    | 'markdown'
```

`source` 是权威数据。

Visual Editing 可以拥有自己的解析状态，但不能成为唯一数据来源。

原则：

```text
Source is canonical.
Views are projections.
```

也就是：

```text
HTML Source
    │
    ├── Visual Projection
    ├── Source Projection
    ├── Preview Projection
    └── Diagnostic Projection
```

这是 SoEditor 与 CKEditor 5 很重要的区别。

---

# 8. 但是不要每次按键都重新 Parse HTML

Document Source 是最终 canonical data，不意味着：

```text
keydown
→ serialize DOM
→ parse HTML
→ render DOM
```

这是错误设计。

Visual Editor 内部需要一个短生命周期 Editing State：

```text
Document Source
      ↓
Editing State
      ↓
Visual DOM
```

用户编辑：

```text
Visual DOM
      ↓
Transaction
      ↓
Editing State
      ↓
Incremental serialization
      ↓
Document Source
```

这样才能兼顾性能和 HTML 自由度。

---

# 9. EditorState

```ts
export interface EditorState {
    document: EditorDocument

    selection: EditorSelection

    mode: EditorMode

    readonly: boolean

    dirty: boolean
}
```

Mode：

```ts
export type EditorMode =
    | 'visual'
    | 'source'
    | 'markdown'
    | 'preview'
```

注意：

`preview` 可以是 View Mode，不一定修改 EditorState。

后续可以再决定是否拆分。

---

# 10. Transaction

所有真正修改文档的数据操作都应该形成 Transaction。

```ts
export interface Transaction {
    id: string

    origin:
        | 'user'
        | 'command'
        | 'plugin'
        | 'source'
        | 'system'

    before: EditorState

    after?: EditorState

    operations: Operation[]

    metadata: Map<string, unknown>
}
```

例如：

```text
InsertText
DeleteRange
SetAttribute
WrapElement
InsertNode
RemoveNode
ReplaceHTML
```

第一版不要过度抽象。

可以从：

```ts
type Operation =
    | ReplaceRangeOperation
    | ReplaceDocumentOperation
```

开始。

之后再根据需求扩展。

---

# 11. Undo / Redo

Undo / Redo 不应该依赖浏览器自己的：

```text
document.execCommand('undo')
```

而应该依赖 Transaction History。

```text
Transaction
    ↓
History
    ↓
Undo Stack
Redo Stack
```

这样 Source Editing 和 Visual Editing 才能共享 History。

这是 SoEditor 0.1 必须解决的问题之一。

---

# 12. Commands

所有可操作功能必须优先暴露 Command。

API：

```ts
export interface Command {
    id: string

    execute(
        editor: Editor,
        ...args: unknown[]
    ): void | Promise<void>

    canExecute?(
        editor: Editor
    ): boolean

    isActive?(
        editor: Editor
    ): boolean
}
```

注册：

```ts
editor.commands.register({
    id: 'format.bold',

    execute(editor) {
        // ...
    }
})
```

调用：

```ts
editor.execute('format.bold')
```

---

# 13. Command ID 命名

统一：

```text
editor.undo
editor.redo

format.bold
format.italic
format.underline

paragraph.heading

link.insert
link.remove

image.insert

table.insert
table.addRow
table.removeRow

source.toggle

preview.open

document.format
document.validate
```

避免：

```text
bold
doBold
cmdBold
insert_table
```

统一使用：

```text
namespace.action
```

---

# 14. Plugin

Plugin 是 SoEditor 扩展系统的基本单位。

```ts
export interface PluginContext {
    editor: Editor
}

export abstract class Plugin {
    static id: string

    constructor(
        protected readonly context: PluginContext
    ) {}

    init?(): void | Promise<void>

    ready?(): void | Promise<void>

    destroy?(): void | Promise<void>
}
```

生命周期：

```text
construct
   ↓
init
   ↓
all plugins initialized
   ↓
ready
   ↓
editor running
   ↓
destroy
```

---

# 15. Plugin Dependency

```ts
export class ImagePlugin extends Plugin {
    static id = 'image'

    static requires = [
        EssentialsPlugin
    ]
}
```

PluginManager 必须负责：

```text
Dependency resolution
Duplicate detection
Circular dependency detection
Lifecycle
Error isolation
```

---

# 16. Contribution

Plugin 不应该全部通过 imperative API 修改 UI。

应该支持声明式 Contribution。

例如：

```ts
export interface PluginDefinition {
    id: string

    contributes?: {
        commands?: CommandContribution[]

        toolbar?: ToolbarContribution[]

        menu?: MenuContribution[]

        shortcuts?: ShortcutContribution[]

        diagnostics?: DiagnosticContribution[]

        formatters?: FormatterContribution[]
    }
}
```

例如：

```ts
export default definePlugin({
    id: 'bold',

    contributes: {
        toolbar: [
            {
                id: 'bold',
                command: 'format.bold',
                icon: 'bold',
                group: 'format'
            }
        ],

        shortcuts: [
            {
                key: 'Mod+B',
                command: 'format.bold'
            }
        ]
    }
})
```

未来：

```text
Command Palette
Context Menu
Sidebar
Status Bar
Inspector
Outline
```

都采用同样机制。

---

# 17. Service Registry

不要让 Plugin 互相直接 import。

例如：

```text
ImagePlugin
↓
直接 import UploadPlugin
```

会形成严重耦合。

应该：

```ts
editor.services.get('upload')
```

定义：

```ts
export interface ServiceRegistry {
    register<T>(
        id: string,
        service: T
    ): void

    get<T>(id: string): T | undefined
}
```

例如：

```text
upload
fileManager
dialog
notification
formatter
diagnostics
preview
storage
```

这样未来 SoFinder 可以注册：

```text
fileManager
```

SoEditor Image Plugin 只知道：

```ts
editor.services.get<FileManager>(
    'fileManager'
)
```

而不知道：

```text
SoFinder
CKFinder
Custom File Manager
```

这是 SoEditor 与 SoFinder 集成最重要的接口之一。

---

# 18. File Manager API

定义标准接口：

```ts
export interface FileManager {
    open(
        options: FileManagerOpenOptions
    ): Promise<FileManagerResult | null>
}
```

例如：

```ts
interface FileManagerResult {
    url: string

    name?: string

    width?: number

    height?: number

    mime?: string

    metadata?: Record<string, unknown>
}
```

ImagePlugin：

```ts
const manager =
    editor.services.get<FileManager>('fileManager')

const file = await manager?.open({
    type: 'image'
})
```

然后：

```text
@soeditor/sofinder
```

负责：

```ts
editor.services.register(
    'fileManager',
    new SoFinderAdapter(...)
)
```

这样 SoEditor 不绑定 SoFinder，但两者天然兼容。

---

# 19. Visual Editor

Visual Editor 第一版使用：

```text
contenteditable
```

但不要使用：

```text
document.execCommand
```

作为核心操作系统。

需要独立封装：

```text
SelectionBridge
DOMObserver
InputHandler
ClipboardHandler
MutationNormalizer
```

目录：

```text
engine/
├─ editing-surface.ts
├─ selection.ts
├─ input.ts
├─ clipboard.ts
├─ mutation.ts
├─ normalize.ts
└─ serializer.ts
```

---

# 20. HTML preservation

SoEditor 的核心原则：

```text
未知元素 ≠ 无效元素
```

例如：

```html
<product-card
    sku="10001"
    theme="dark"
>
    Product
</product-card>
```

如果 SoEditor 没有对应 Plugin：

不能删除。

不能转换为：

```html
<p>Product</p>
```

应该：

```text
Preserve
```

Visual Mode 中可以：

```text
┌─────────────────────────┐
│ <product-card>           │
│ Unsupported HTML element│
└─────────────────────────┘
```

Source Mode：

完整显示源码。

Preview：

正常渲染。

未来安装插件：

```text
@soeditor/plugin-product-card
```

即可提供 Visual Representation。

---

# 21. HTML Sanitization

Preserve HTML 不等于无条件执行 HTML。

必须区分：

```text
Preservation
Rendering
Execution
```

例如：

```html
<script>alert(1)</script>
```

可以：

```text
source: preserve
visual: disabled
preview: disabled by default
output: controlled by policy
```

必须建立：

```ts
interface HtmlSecurityPolicy {
    allowElement(name: string): boolean

    allowAttribute(
        element: string,
        attribute: string
    ): boolean

    allowUrl(
        url: string,
        context: UrlContext
    ): boolean
}
```

默认禁止危险执行。

---

# 22. Source Editing

Source Editing 使用：

```text
CodeMirror 6
```

SoEditor 不重新实现：

```text
syntax highlighting
code folding
selection
search
brackets
indentation
```

Source Plugin 负责：

```text
SoEditor Document
     ↕
CodeMirror State
```

切换：

```text
Visual
↓
Serialize
↓
Source

Source
↓
Validate
↓
Parse
↓
Visual
```

---

# 23. Source → Visual 错误处理

这是非常关键的 UX。

用户可能输入：

```html
<div>
    <strong>Hello
</div>
```

绝对不能：

```text
Source → Visual
→ 自动修复
→ 用户原始代码消失
```

应该允许三种状态：

```text
Valid
Recoverable
Invalid
```

对于 Recoverable：

显示 Warning。

对于 Invalid：

Source Mode 保持用户代码。

Visual Mode 可以继续显示最后一个有效版本。

例如：

```text
Source contains errors.

Visual preview is showing the last valid document.
```

这样最安全。

---

# 24. Diagnostics

统一接口：

```ts
export interface Diagnostic {
    source: string

    severity:
        | 'error'
        | 'warning'
        | 'info'
        | 'hint'

    message: string

    range?: SourceRange

    code?: string
}
```

Provider：

```ts
export interface DiagnosticProvider {
    id: string

    provide(
        document: EditorDocument
    ): Diagnostic[] | Promise<Diagnostic[]>
}
```

插件：

```text
html.syntax
html.structure
html.accessibility
html.security
html.seo
```

---

# 25. Problems Panel

最终 UI：

```text
Problems (4)

ERROR
Line 12
Unexpected closing tag </div>

WARNING
Line 26
<img> should have alt attribute

WARNING
Line 47
Duplicate id="main"

INFO
Line 71
Consider adding rel="noopener"
```

点击问题跳转 Source Editor。

这个功能非常值得成为 SoEditor 的核心卖点。

---

# 26. Formatter

Formatter 独立 Service：

```ts
export interface Formatter {
    id: string

    supports(format: DocumentFormat): boolean

    format(
        source: string,
        options?: FormatterOptions
    ): Promise<string>
}
```

HTML 第一版：

```text
Prettier
```

Command：

```text
document.format
```

不要把 Prettier 放进 core。

---

# 27. Preview

Preview 必须使用：

```text
iframe
```

而不是：

```text
<div dangerouslyInsertHTML>
```

架构：

```text
Document
   ↓
PreviewRenderer
   ↓
Template
   ↓
iframe
```

Config：

```ts
preview: {
    css: [
        '/css/bootstrap.css',
        '/css/article.css'
    ],

    template: `
        <!doctype html>
        <html>
        <head></head>
        <body>
            <main>
                {{content}}
            </main>
        </body>
        </html>
    `
}
```

或者：

```ts
preview: {
    templateUrl:
        '/editor-preview.html'
}
```

---

# 28. Preview Context

支持：

```ts
preview: {
    context: {
        title: 'Example',
        category: 'News'
    }
}
```

Template：

```html
<h1>{{ title }}</h1>

<div>
    {{ content }}
</div>
```

以后 CMS 可以传入：

```text
title
author
date
category
breadcrumb
```

进行真实页面预览。

---

# 29. Markdown

Markdown 不作为 HTML 的附属转换工具。

而是独立 Document Format：

```ts
format: 'markdown'
```

Markdown Processor：

```ts
export interface DataProcessor {
    id: DocumentFormat

    parse(source: string): ParsedDocument

    serialize(
        document: ParsedDocument
    ): string
}
```

第一版 Markdown 可以使用：

```text
remark
micromark
markdown-it
```

中的成熟方案。

不要自己写 parser。

---

# 30. HTML ↔ Markdown

SoEditor 不承诺：

```text
HTML → Markdown → HTML
100% lossless
```

对于：

```html
<div class="product">
```

Markdown 可以：

```md
<div class="product">
...
</div>
```

也就是允许：

```text
Raw HTML passthrough
```

以最大程度保护内容。

---

# 31. UI

UI Core 不依赖 React/Vue。

推荐：

```text
TypeScript
DOM
Web Components
CSS Variables
```

最初不必所有组件都强制 Custom Elements。

内部可以先使用：

```ts
class ToolbarView {}
class ButtonView {}
class DialogView {}
```

对外层再逐步支持：

```html
<so-editor>
```

不要因为追求 Web Components 而增加早期复杂度。

---

# 32. Theme

必须从第一版支持 CSS Variables：

```css
:root {
    --soeditor-bg: #fff;
    --soeditor-text: #1f2328;

    --soeditor-border: #d0d7de;

    --soeditor-toolbar-height: 40px;

    --soeditor-radius: 6px;

    --soeditor-font-family:
        system-ui,
        sans-serif;
}
```

支持：

```text
light
dark
auto
```

第三方 Theme：

```text
@soeditor/theme-dark
```

---

# 33. Toolbar

配置必须简单。

```ts
toolbar: [
    'undo',
    'redo',
    '|',
    'heading',
    '|',
    'bold',
    'italic',
    'link',
    '|',
    'image',
    'table',
    '|',
    'source',
    'preview'
]
```

同时支持高级配置：

```ts
toolbar: {
    items: [...],

    sticky: true,

    overflow: true
}
```

---

# 34. Presets

提供：

```text
classic
minimal
developer
markdown
```

例如：

```ts
import {
    DeveloperEditor
} from 'soeditor/presets/developer'
```

或者：

```ts
SoEditor.create('#editor', {
    preset: 'developer'
})
```

Developer：

```text
Visual
Source
Preview
Diagnostics
Formatter
Element Path
Command Palette
```

---

# 35. npm API

推荐：

```bash
pnpm add soeditor
```

使用：

```ts
import {
    SoEditor
} from 'soeditor'

import {
    Image
} from '@soeditor/plugin-image'
```

创建：

```ts
const editor = await SoEditor.create(
    '#editor',
    {
        plugins: [
            Image
        ]
    }
)
```

---

# 36. CDN API

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/soeditor/dist/soeditor.css"
>

<script
    src="https://cdn.jsdelivr.net/npm/soeditor/dist/soeditor.umd.js"
></script>
```

使用：

```html
<script>
SoEditor.create(
    '#editor',
    {
        preset: 'classic'
    }
)
</script>
```

Plugin：

```html
<script src="soeditor.js"></script>
<script src="soeditor-plugin-table.js"></script>
```

插件自动注册：

```text
SoEditor.plugins.register(...)
```

---

# 37. Build

每个 Package 输出：

```text
ESM
Type declarations
Source maps
CSS
```

主包额外输出：

```text
UMD
```

推荐：

```text
dist/
├─ index.js
├─ index.d.ts
├─ soeditor.css
├─ soeditor.umd.js
├─ soeditor.umd.min.js
└─ sourcemaps/
```

---

# 38. Tree Shaking

npm 用户必须能够：

```ts
import { Editor } from '@soeditor/core'

import { Bold } from '@soeditor/plugin-basic-styles'
```

而不会下载：

```text
Table
Markdown
Source Editor
Prettier
CodeMirror
Preview
```

因此：

```text
sideEffects
exports
ES modules
```

必须正确配置。

---

# 39. SoFinder Integration

不要直接：

```text
SoEditor depends on SoFinder
```

而是：

```text
@soeditor/plugin-file-manager
        │
        ▼
FileManager Service
        ▲
        │
@soeditor/adapter-sofinder
```

最终：

```ts
import {
    SoFinderAdapter
} from '@soeditor/adapter-sofinder'

editor.services.register(
    'fileManager',
    new SoFinderAdapter({
        url: '/sofinder'
    })
)
```

以后别人也可以实现：

```text
CKFinderAdapter
S3Adapter
R2Adapter
CustomCMSAdapter
```

---

# 40. Extension SDK

未来第三方插件开发体验：

```bash
npm create soeditor-plugin
```

生成：

```text
my-plugin/
├─ src/
│  ├─ index.ts
│  ├─ plugin.ts
│  └─ styles.css
├─ tests/
├─ package.json
└─ vite.config.ts
```

Plugin：

```ts
import {
    Plugin
} from '@soeditor/core'

export class MyPlugin extends Plugin {
    static id = 'my-plugin'

    init() {
        this.editor.commands.register(...)
    }
}
```

---

# 41. Plugin Manifest

未来可以引入：

```json
{
    "name": "@example/soeditor-plugin-demo",
    "soeditor": {
        "id": "demo",
        "apiVersion": "^1.0.0"
    }
}
```

类似 VSCode extension compatibility。

SoEditor 可以检查：

```text
Plugin API incompatible
```

而不是直接运行到崩溃。

---

# 42. API Stability

从项目第一天区分：

```text
Public API
Internal API
Experimental API
```

例如：

```ts
@public
@internal
@experimental
```

只有：

```text
@public
```

承诺 SemVer。

否则以后很难升级 Core。

---

# 43. Event

统一 EventBus：

```ts
editor.events.on(
    'document:change',
    event => {}
)
```

推荐：

```text
editor:ready
editor:destroy

document:beforeChange
document:change

selection:change

mode:change

command:beforeExecute
command:afterExecute

plugin:error
```

避免几十种：

```text
onChange
onDataChange
onContentChange
onHtmlChange
```

---

# 44. Config

推荐：

```ts
const config = {
    language: 'zh-CN',

    height: 500,

    preset: 'developer',

    toolbar: [...],

    contentCss: [
        '/article.css'
    ],

    preview: {
        css: [
            '/site.css'
        ]
    },

    diagnostics: {
        html: true,
        accessibility: true
    }
}
```

Config 支持：

```text
defaults
preset
global
instance
```

合并顺序：

```text
defaults
   ↓
preset
   ↓
global config
   ↓
instance config
```

后者覆盖前者。

---

# 45. MVP 0.1

必须完成：

## Core

```text
Editor
State
Document
Transaction
PluginManager
CommandRegistry
EventBus
ServiceRegistry
Config
```

## Visual

```text
Paragraph
Heading

Bold
Italic
Underline
Strike

Link

Ordered List
Unordered List

Blockquote
Inline Code
Code Block

Image
Basic Table
```

## Editing

```text
Selection
Clipboard
Undo
Redo
Keyboard shortcuts
```

## Source

```text
CodeMirror
HTML highlighting
Source ↔ Visual
```

## Developer Features

```text
HTML diagnostics
HTML formatting
```

## Preview

```text
iframe
content CSS
preview CSS
preview template
```

## Distribution

```text
npm
ESM
UMD/CDN
TypeScript declarations
```

---

# 46. MVP 0.2

```text
Markdown

Command Palette

Context Menu

Status Bar

Element Path

Word Count

Find / Replace

Plugin contribution API
```

---

# 47. MVP 0.3

```text
HTML Inspector

Outline

Accessibility diagnostics

SEO diagnostics

Snippets

Autosave

Theme packages

Custom HTML Components
```

---

# 48. 核心架构规则

下面规则禁止 Codex 自行修改。

### Rule 1

Core 不依赖 UI Framework。

### Rule 2

Core 不依赖 CodeMirror。

### Rule 3

Core 不依赖 Prettier。

### Rule 4

Core 不依赖 Markdown Parser。

### Rule 5

具体 Feature 必须优先实现为 Plugin。

### Rule 6

用户可触发操作必须优先实现为 Command。

### Rule 7

UI 调用 Command，而不是直接操作 Document。

### Rule 8

未知 HTML 默认保留。

### Rule 9

危险 HTML 可以禁止执行，但不能因为无法显示而静默删除。

### Rule 10

Source Editing 必须视为一等功能，而不是 textarea fallback。

### Rule 11

Preview 必须与 Editor UI 隔离。

### Rule 12

npm Package 必须支持 Tree Shaking。

### Rule 13

所有正式 Public API 必须有 TypeScript 类型。

### Rule 14

所有 Core API 必须有 Unit Test。

### Rule 15

插件不得依赖 Core 私有实现。

---

# 49. SoEditor 的产品差异

最终 SoEditor 不应该只是：

```text
Rich Text Editor
```

而应该形成：

```text
Visual Content Editor
+
HTML IDE
+
Markdown Editor
+
Content Preview Environment
+
Plugin Platform
```

用户既可以像 CKEditor 4 一样：

```text
打开 → 编辑 → 保存 HTML
```

也可以像开发工具一样：

```text
Source

Format Document

Problems

Command Palette

Preview

Inspector

Plugins
```

这才是 SoEditor 最值得建立的长期方向。
