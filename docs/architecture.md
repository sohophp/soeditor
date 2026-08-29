# SoEditor Architecture 0.5

## Current implementation status

Phases 1–15 are implemented. Runtime document formats are `html | markdown`
and projections are `visual | source | markdown | preview`. HTML and Markdown
remain canonical source formats for separate editor instances; projection
changes never perform an implicit format conversion. Later sections that
describe post-Phase-15 capabilities remain product direction rather than an
implementation claim.

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

## Phase 2 HTML document layer

Phase 2 introduces `@soeditor/html` as an independent, framework-free package:

```text
HTML source
    ↕
@soeditor/html
    ↕
SoEditor HtmlTree
```

HTML source remains the canonical serialized and persistence representation.
`HtmlTree` is the immutable structured representation used while content is
parsed, inspected, or serialized. Complete documents and fragments are both
first-class inputs.

The package uses parse5 internally for WHATWG-oriented parsing, error recovery,
source locations, and semantic serialization. Conversion adapters isolate that
dependency: public nodes, attributes, locations, diagnostics, parser contracts,
and serializer contracts are all SoEditor-owned types. parse5 AST types are not
part of the extension API.

The tree preserves custom elements, unknown and namespaced attributes, comments,
doctypes, template content, and HTML/SVG/MathML namespaces. Parser-synthesized
nodes deliberately have no invented source range. Round trips promise semantic
preservation, not byte-for-byte formatting or casing preservation.

Parsing does not sanitize or execute content. Scripts and event-handler
attributes can remain represented in the tree while later rendering and
security layers independently decide whether they may execute. Phase 2 adds no
DOM, visual editing, selection, history, source editor, preview, or formatting
behavior.

## Phase 3 minimal visual editing engine

Phase 3 turns `@soeditor/engine` into the first browser-dependent editing
package. Dependency direction remains one way:

```text
@soeditor/core      @soeditor/html
        \              /
         @soeditor/engine
                 ↓
      controlled contenteditable DOM
```

The engine derives a short-lived immutable editing model from an HTML fragment.
Paragraphs contain text runs marked with `strong` and/or `em`; unsupported
elements and comments remain opaque `@soeditor/html` tree values. Complete HTML
documents remain source-preserved and display a locked placeholder in this
minimal engine.

The live DOM is only a projection and selection bridge. Supported values are
rendered with explicit DOM construction. Unsupported values render as inert,
non-editable labels, so preserved scripts, event attributes, embeds, and custom
markup are not injected or executed. A mutation observer restores the model
projection after an out-of-band DOM mutation.

Handled `beforeinput` events are prevented, converted to editing-model
operations, semantically serialized by `@soeditor/html`, and committed through
a Core transaction with `origin: 'user'`. The initial operations cover text and
IME composition insertion, basic selection replacement, paragraph splitting
and merging, backward/forward deletion, and strong/emphasis range marks.
Unhandled mutating input is prevented until a controlled implementation exists.

Selection uses engine-owned block/UTF-16-offset points. The DOM bridge reads and
restores native selections after controlled rendering. History, clipboard,
advanced selection semantics, rich-text plugins, and incremental rendering are
not part of Phase 3.

## Phase 4 selection, history, and clipboard

Phase 4 adds `HistoryPlugin` in `@soeditor/engine`. It observes committed Core
document transactions and exposes `editor.undo` / `editor.redo` commands.
Entries store bounded canonical before/after source snapshots plus structured
selection snapshots when an editing surface supplies them. Replay always uses a
new Core transaction; browser-native undo is prevented at the visual surface.

Private transaction metadata connects the visual engine and history plugin:

```text
controlled input
    ↓
Core transaction + selection/group metadata
    ↓
HistoryPlugin source snapshot
    ↓
editor.undo / editor.redo replay transaction
    ↓
visual model rebuild + selection restoration
```

Typing and repeated deletion group only across matching source, selection,
group, and time continuity. Paragraph, formatting, paste, cut, and external
source transactions remain distinct. A new committed edit clears redo.

The visual surface owns copy, cut, and paste events. Copy derives `text/plain`
and semantic `text/html` from the structured model. Paste prefers HTML parsed by
`@soeditor/html`; inline runs are normalized into paragraphs, while plain text
normalizes CRLF and LF into paragraph blocks. Inserted custom or executable
markup remains opaque and inert in the editing projection. Selection or delete
operations that cross opaque content or would silently remove retained
paragraph attributes are rejected.

History currently uses a bounded source-snapshot strategy. Operation inversion,
advanced selection, platform word deletion, table/widget clipboard behavior,
and office-grade paste cleanup remain deferred.

## Phase 5 rich-text feature boundary

Phase 5 adds `@soeditor/rich-text`, a framework-neutral package of individual
feature plugins. Paragraph, heading, five inline formats, links, ordered and
unordered lists, blockquote, code block, image, and basic table behavior are
registered as commands. No feature method is added to `Editor`.

```text
future UI / shortcut / consumer
              ↓
   @soeditor/rich-text command
              ↓
 typed VisualEditingService token
              ↓
 controlled model operation
              ↓
 Core transaction + history metadata
              ↓
 canonical semantic HTML
```

The engine registers the visual service per editor and removes it when the
surface is independently destroyed. Its public contract contains only editing
actions and state queries; plugins cannot access the DOM projection or mutable
editing representation.

The controlled subset now recognizes `p`, headings, minimal `blockquote` and
`pre` blocks; `strong`, `em`, `u`, `s`, `code`, and link marks; and simple
attribute-free ordered/unordered lists. Existing link source attributes are
retained, while the editing DOM intentionally omits executable link URL
attributes. Complex lists and unsupported structures remain opaque. Inserted
images and tables are semantic source structures but inert placeholders in the
visual surface. Advanced widgets, nested lists, pending collapsed-caret marks,
and configurable schemas remain deferred.

## Phase 6 source editing

Phase 6 adds browser package `@soeditor/source`. `SourceEditingPlugin` registers
`editor.source` and `editor.visual`; both mode transitions are Core
transactions. `SourceEditingEngine` owns a CodeMirror 6 HTML surface and a
per-editor typed source service.

```text
CodeMirror document (exact user text)
              ↓ update listener
 Core replace-document transaction
              ↓ document:change
 canonical EditorDocument source
       ↙                    ↘
source synchronization   visual parsing/projection
```

Source keystrokes commit the exact complete string without an HTML
parse/serialize round trip. External, visual, programmatic, and history changes
synchronize back into CodeMirror with a non-history CodeMirror transaction and
a feedback-loop guard. CodeMirror's HTML language package provides highlighting
and editor behavior. `@soeditor/html` document/fragment diagnostics are mapped
to its lint UI, but public services return only SoEditor diagnostic types.

When `HistoryPlugin` is present, high-priority CodeMirror undo/redo shortcuts
invoke the shared `editor.undo` / `editor.redo` commands. Consecutive
`source`-origin snapshots group within the existing history time window. A
surface without Core history falls back to CodeMirror's local history.

Only the active surface is visible and editable. Invalid source remains
canonical and source-editable. The visual engine retains its last parse-valid
fragment model as a locked projection while parser errors exist, so a recovered
tree cannot be edited and serialized over the invalid source. It resumes from
the new model after source becomes valid. Initial invalid source uses an inert
placeholder; complete documents keep the existing locked-source policy.

CodeMirror packages are runtime dependencies of `@soeditor/source` and are
external imports in its library build. Core, HTML, engine, and rich-text
packages remain CodeMirror-independent.

## Phase 7 HTML diagnostics and formatting

Phase 7 adds framework-neutral `@soeditor/html-tools`. Its diagnostics plugin
owns an ordered per-editor provider registry and exposes it through a typed Core
service token. Validation results are immutable SoEditor problem values:

```text
severity + message + code + provider + optional SourceRange
```

Providers may be synchronous or asynchronous. A failed or stale validation does
not replace the last successfully published current-document problems. Built-in
providers map parser errors and warn about duplicate IDs, missing image `alt`,
and complete documents missing root `lang`. They do not treat custom markup,
comments, SVG/MathML, templates, or unsafe attributes as errors by category.

`document.validate` is the UI-independent command entry point. Phase 8 may
project the same service into a Problems panel; Phase 7 adds no reusable UI.

`HtmlFormattingPlugin` requires diagnostics and registers `document.format`.
The command validates a captured source/revision, refuses parser-invalid input,
calls pinned Prettier standalone with the HTML plugin, rechecks the snapshot,
and commits the formatted string through a Core command transaction. Formatting
is always explicit and therefore may deliberately normalize layout; parsing or
mode switching never invokes it.

Prettier is externalized from the `@soeditor/html-tools` library build, loaded
only when formatting is requested, and its types do not cross the public
boundary. The SoEditor API exposes only a small validated formatting option
subset.

## Phase 8 editor UI system

Phase 8 adds browser-facing `@soeditor/ui` while Core remains DOM- and
framework-independent. `UiPlugin` owns a per-editor registry of named toolbar
factories and keyboard shortcuts. Duplicate contribution IDs and shortcut
chords fail explicitly, registrations have idempotent disposers, and retained
registries become terminal with editor destruction.

`createEditorUi` attaches one controlled UI instance to a caller-owned host. An
ordered string configuration resolves registered toolbar items and `|` group
separators. Included items cover current undo/redo, block style, inline
formatting, links, images, tables, source mode, and HTML formatting. Buttons,
menus, dialogs, and host-scoped shortcuts invoke the same Core commands as
external integrations.

The UI remembers the last DOM selection inside an editing surface and restores
it before a toolbar or dialog command. This permits native controls to receive
focus without making visual commands bypass the controlled engine. Visual
feature commands are unavailable outside Visual mode.

One attached instance owns its toolbar, native modal dialogs, anchored balloon
layer, accessible notifications, mode/dirty status region, listeners, and theme
attribute. Destruction removes only UI-owned DOM and is automatic on Core editor
destruction. Overlay string content uses `textContent`; callers may alternatively
supply DOM nodes or safe construction callbacks.

The package publishes scoped CSS separately as `@soeditor/ui/styles.css`.
Light, dark, and automatic color-scheme foundations use `--soeditor-*` custom
properties and remain overridable by the host application.

## Phase 9 preview environment

Phase 9 adds browser-facing `@soeditor/preview`. `PreviewPlugin` registers mode,
close, and refresh commands; an attached preview engine registers the narrow
per-editor refresh service. Entering Preview is a Core mode transaction and
closing returns to the Visual or Source mode that opened it.

The engine owns one iframe in an otherwise empty caller host. Canonical changes
regenerate `srcdoc` without writing preview normalization back to editor state.
When Preview is inactive, changes only mark the frame stale so hidden previews
do not reload network resources; entering Preview performs the pending refresh.
Fragments use an application template with one raw `{{ content }}` marker and
escaped string context markers. Complete HTML documents render as their own
document. Application inline CSS, stylesheet URLs, an HTTP(S) base URL, and an
accessible frame title are immutable validated configuration.

Preview uses an empty iframe `sandbox` token set and `no-referrer`. Before
serialization, preview-only DOM processing removes source/template CSP, meta
refresh, and base elements; inserts only the configured base; and prepends a
fixed CSP. Scripts, connections, frames, objects, forms, and navigation are
blocked while passive style, image, font, and media resources may load. Scripts
and event attributes can remain preserved in canonical/source preview markup
without executing or receiving the editor origin.

Preview engine attachment rejects non-empty hosts and duplicate per-editor
services before data loss. Manual or editor-owned destruction removes only its
iframe, unregisters the service, restores mode/host visibility, and makes
retained service references terminal.

## Phase 10 Markdown workflow

Phase 10 adds browser-facing `@soeditor/markdown` without introducing Markdown
dependencies into Core. A Markdown editor stores exact canonical Markdown and
defaults to Markdown mode. Its CodeMirror 6 surface synchronizes through Core
transactions, groups source history for the shared undo/redo commands, enforces
readonly state, and exposes only a typed focus capability. HTML Visual and
Source engines reject Markdown documents before touching their hosts; the
Markdown engine applies the reciprocal format guard.

Pinned micromark compiles CommonMark for projection. Raw HTML passthrough is
enabled by default and dangerous URL protocols are disabled, but rendered HTML
is explicitly not sanitized. A format-aware Preview renderer feeds that result
into the existing empty-sandbox iframe and fixed CSP, which remains the
execution boundary. Preview itself depends only on a small SoEditor-owned
content-renderer interface and has no Markdown parser dependency.

Intentional HTML-to-Markdown conversion uses pinned Turndown and returns both
Markdown and immutable loss notices. Custom, namespaced, and template elements
remain raw HTML where practical. Document chrome, comments, attributes, and
unsupported structures may be discarded or normalized, so no HTML/Markdown
round-trip guarantee exists. GFM, MDX, frontmatter interpretation, Markdown
diagnostics, and visual Markdown editing remain deferred.

## Phase 11 developer tools

Phase 11 adds browser-facing `@soeditor/dev-tools`. HTML analysis remains
read-only and uses the public SoEditor HTML tree, diagnostics service, Source
service, and generic UI capabilities. The package provides docked Problems,
selection-derived element path and Inspector, a source-backed heading Outline,
Find/Replace, a searchable command palette, and navigation from Problems or
Outline entries to CodeMirror source ranges.

Core remains UI- and DOM-independent. Commands may now publish an optional
human-readable label to opt a no-argument action into palettes, while
`editor.commands.ids()` returns an immutable registration-order snapshot. The
mutable registry remains private. `@soeditor/ui` gains one generic accessible
docked-panel service and does not depend on HTML or developer tooling.

The HTML Source service owns range reveal and CodeMirror's built-in Find/Replace
panel behind SoEditor-owned APIs. No CodeMirror types cross the package root.
The Inspector reads the controlled visual selection as a non-authoritative
projection and never mutates canonical source. Split views are deferred because
the current architecture intentionally has one active projection at a time.

## Phase 12 file manager and SoFinder integration

Phase 12 adds browser-facing `@soeditor/file-manager` as an application-owned
selection capability. `FileManagerPlugin` contributes `image.browse`, permits
only one pending picker per editor, validates the returned value, and delegates
the actual mutation to the existing `image.insert` command. Neither
`ImagePlugin` nor Core knows which manager produced the asset.

Selection results are treated as untrusted integration data. The boundary
rejects accessors, malformed dimensions, control characters, executable URL
schemes, cycles, non-JSON metadata, excessive metadata depth/size, and mutable
input aliases. Cancellation is an explicit no-op, and late results cannot edit
an editor whose plugin lifecycle has ended.

`@soeditor/adapter-sofinder` maps an injected `SoFinderPicker` function to that
generic capability. The repository has no authoritative SoFinder SDK contract,
so the host remains responsible for loading SoFinder, authentication, dialog
security, and adapting its concrete selection value. The adapter has no
SoFinder runtime dependency and no SoFinder detail enters Core, Rich Text, or
generic UI.

## Phase 13 plugin SDK, contributions, and presets

Phase 13 adds `@soeditor/plugin-sdk` as a small ESM facade over intentionally
public SoEditor-owned extension contracts. The original packages continue to
own lifecycle, commands, services, diagnostics, FileManager, and UI registries;
the facade creates no second runtime and exports no third-party implementation
types or private subpaths.

The UI contribution service now accepts per-editor status-item factories in
addition to toolbar factories and shortcuts. Attached UI instances mount,
update, isolate failures from, and destroy those contributions alongside their
existing editor-owned chrome. The primary status API and DOM identity remain
compatible.

`@soeditor/presets` publishes frozen minimal, classic, developer, and Markdown
definitions containing only format, public plugin constructors, and toolbar
configuration. Surface attachment, Preview policy, and FileManager
implementations remain explicit application responsibilities. Composition
returns a new frozen preset and rejects duplicate plugin IDs.

## Phase 14 distribution and integration

Phase 14 adds the thin `soeditor` umbrella as a convenience projection over
intentionally public package roots. `Editor` is also exported as `SoEditor`;
the scoped packages remain the ownership and tree-shaking boundaries. The ESM
build externalizes scoped packages and publishes declarations plus source maps.

`@soeditor/presets` now has independent minimal, classic, developer, and
Markdown subpath entries. A clean Vite consumer proves that importing the
umbrella with the minimal preset removes unrelated feature families.

The direct-browser IIFE bundles the public API and assigns one frozen
`globalThis.SoEditor` namespace. It delegates creation to Core, has no global
plugin registry, and performs no automatic mounting. Standalone CSS and a
JavaScript source map accompany it. See `docs/distribution.md` and ADR 0020.

## Phase 15 release hardening

The 0.5 release gate keeps the Phase 14 architecture unchanged and adds
evidence around it. All 15 publishable packages share version 0.5.0. A release
audit checks explicit export maps, mapped artifacts, and bundle budgets; packed
NodeNext/native ESM/Vite consumers exercise actual tarballs.

The Playground exposes Classic, Developer, Markdown, and CMS + injected
SoFinder routes. Chromium release tests cover that matrix, an end-to-end CMS
preservation/asset/Preview path, accessibility semantics, and repeated
editor/UI/visual lifecycle cleanup under a generous regression budget.
Operational and product limitations are recorded in `docs/status.md` rather
than hidden behind speculative abstractions.

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
import { SoEditor, minimalPreset } from 'soeditor';
import 'soeditor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
```

Visual 和 UI surface 由应用显式创建并管理生命周期。需要更细粒度的依赖
边界时，直接使用 `@soeditor/*` 包及 `@soeditor/presets/minimal` 等窄入口。

---

# 36. CDN API

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/soeditor@0.5.0/dist/soeditor.css"
>

<script
    src="https://cdn.jsdelivr.net/npm/soeditor@0.5.0/dist/soeditor.global.js"
></script>
```

使用：

```html
<script>
const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: SoEditor.classicPreset.format,
    plugins: SoEditor.classicPreset.plugins,
});
</script>
```

`globalThis.SoEditor` 是冻结的显式 API facade，不提供全局可变插件注册表，
也不会自动创建或挂载编辑器。浏览器全局不是架构事实来源。

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
