# Codex Master Prompt #1 — SoEditor Bootstrap + Core Architecture

你正在从零开发一个新的 TypeScript 编辑器项目：

**SoEditor**

项目目标不是复制 CKEditor，而是构建一个：

- HTML-first
- Plugin-first
- Developer-first
- Framework-agnostic
- 可通过 npm 和 CDN 发布
- 可扩展为 Visual / Source / Markdown / Preview 多模式

的现代内容编辑器平台。

当前任务只完成 **Phase 1：Bootstrap + Core Architecture**。

本阶段目标是建立未来所有功能依赖的稳定核心。

---

# 1. 非常重要：本阶段禁止实现的内容

本阶段 **不要实现**：

- Toolbar
- Menu
- Dialog
- Context Menu
- Command Palette
- Bold / Italic / Heading 等具体编辑功能
- Image
- Link
- List
- Table
- Markdown
- CodeMirror
- Prettier
- HTML formatter
- HTML diagnostics
- Preview
- CSS preview
- iframe
- File Manager
- SoFinder integration
- React
- Vue
- Svelte
- Web Components
- Collaboration
- AI
- Autosave
- Clipboard editing
- Selection implementation
- contenteditable editing engine

不要为了“看起来完整”而提前实现这些功能。

本阶段成功标准不是功能数量，而是：

**Core API 是否足够稳定和清晰。**

---

# 2. 技术栈

必须使用：

- TypeScript
- pnpm workspace
- Vite
- Vitest
- ESLint
- Prettier
- Changesets

Node.js 使用当前稳定 LTS。

TypeScript 开启严格模式：

```json
{
    "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true
    }
}
```

避免：

```ts
any
```

除非确实有明确理由。

优先使用：

```ts
unknown
```

---

# 3. Monorepo

建立：

```text
soeditor/
├─ apps/
│  └─ playground/
│
├─ packages/
│  ├─ core/
│  └─ engine/
│
├─ docs/
│  └─ architecture.md
│
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ eslint.config.js
└─ .changeset/
```

当前只创建：

```text
@soeditor/core
@soeditor/engine
```

不要创建更多 package。

---

# 4. Package Responsibility

## @soeditor/core

负责：

- Editor
- EditorState
- EditorDocument
- Transaction
- Operation
- CommandRegistry
- PluginManager
- Plugin
- EventBus
- ServiceRegistry
- Configuration
- Lifecycle
- Errors

不得依赖：

- DOM
- browser APIs
- Vite runtime
- CodeMirror
- Prettier
- Markdown libraries
- React / Vue / Svelte

`@soeditor/core` 必须能够在：

```text
Node.js
Browser
Test environment
```

中运行。

---

## @soeditor/engine

当前只作为未来 Editing Engine 的 package shell。

可以定义少量：

- engine public exports
- future interfaces

但是：

**不要实现 contenteditable。**

不要实现 SelectionBridge。

不要实现 DOM synchronization。

当前重点不是 engine。

---

# 5. Architecture Principle

必须遵守：

```text
Feature → Command → Transaction → EditorState
```

而不是：

```text
Feature → directly mutate Editor
```

UI 将来只能调用 Command。

具体 Feature 将来必须优先做 Plugin。

---

# 6. EditorDocument

定义：

```ts
export type DocumentFormat =
    | 'html'
    | 'markdown';

export interface EditorDocument {
    readonly format: DocumentFormat;

    readonly source: string;

    readonly revision: number;

    readonly metadata: Readonly<Record<string, unknown>>;
}
```

注意：

虽然未来 Markdown 会支持，但当前不实现 Markdown parser。

只允许：

```ts
format: 'html'
```

作为实际使用场景。

类型中保留 markdown 是为了提前稳定 API。

---

# 7. EditorMode

定义：

```ts
export type EditorMode =
    | 'visual'
    | 'source'
    | 'preview';
```

当前默认：

```text
visual
```

但是本阶段不实现 visual editor。

Mode 只是 EditorState 的状态。

---

# 8. EditorState

实现 immutable EditorState。

例如：

```ts
export interface EditorState {
    readonly document: EditorDocument;

    readonly mode: EditorMode;

    readonly readonly: boolean;

    readonly dirty: boolean;
}
```

重要：

EditorState 创建后不能被直接修改。

Transaction 创建新的 State。

---

# 9. Operation

第一阶段不要设计复杂 AST Operation。

只需要两个 Operation：

```ts
export interface ReplaceDocumentOperation {
    type: 'replace-document';

    source: string;
}

export interface SetModeOperation {
    type: 'set-mode';

    mode: EditorMode;
}
```

联合类型：

```ts
export type Operation =
    | ReplaceDocumentOperation
    | SetModeOperation;
```

不要提前增加：

```text
InsertText
DeleteRange
SetAttribute
InsertNode
```

等。

以后根据 Editing Engine 实际需要再增加。

---

# 10. Transaction

实现：

```ts
export type TransactionOrigin =
    | 'user'
    | 'command'
    | 'plugin'
    | 'source'
    | 'system';

export interface TransactionMetadata {
    readonly [key: string]: unknown;
}
```

Transaction 应支持：

```ts
transaction.replaceDocument(source);

transaction.setMode(mode);

transaction.setMeta(key, value);
```

Transaction 自身可变。

但是：

```text
EditorState immutable
```

提交：

```ts
editor.dispatch(transaction);
```

后生成新的 EditorState。

---

# 11. Transaction API

推荐：

```ts
const transaction =
    editor.createTransaction({
        origin: 'command'
    });

transaction.replaceDocument('<p>Hello</p>');

editor.dispatch(transaction);
```

同时提供：

```ts
editor.update(
    transaction => {
        transaction.replaceDocument(
            '<p>Hello</p>'
        );
    },
    {
        origin: 'command'
    }
);
```

`update()` 是 convenience API。

核心仍然：

```text
Transaction
```

---

# 12. Revision

每次 Document Source 实际发生变化：

```text
revision + 1
```

例如：

```text
revision 0
↓
replaceDocument
↓
revision 1
```

单纯：

```text
setMode
```

不能增加 document revision。

---

# 13. Dirty

初始：

```ts
dirty = false
```

Document Source 改变：

```ts
dirty = true
```

需要提供：

```ts
editor.markClean()
```

用于保存后：

```text
dirty = false
```

markClean 不增加 document revision。

---

# 14. Editor

设计：

```ts
export interface EditorCreateOptions {
    data?: string;

    format?: DocumentFormat;

    readonly?: boolean;

    mode?: EditorMode;

    plugins?: readonly PluginConstructor[];

    config?: EditorConfig;
}
```

Editor：

```ts
export class Editor {

    readonly commands: CommandRegistry;

    readonly plugins: PluginManager;

    readonly services: ServiceRegistry;

    readonly events: EventBus;

    get state(): EditorState;

    static create(
        options?: EditorCreateOptions
    ): Promise<Editor>;

    createTransaction(
        options?: TransactionOptions
    ): Transaction;

    dispatch(
        transaction: Transaction
    ): void;

    update(
        callback:
            (transaction: Transaction) => void,
        options?: TransactionOptions
    ): void;

    execute(
        commandId: string,
        ...args: readonly unknown[]
    ): unknown;

    getData(): string;

    setData(
        source: string
    ): void;

    markClean(): void;

    destroy(): Promise<void>;
}
```

注意：

本阶段不要让：

```ts
Editor
```

继承 EventEmitter。

使用：

```ts
editor.events
```

---

# 15. Editor Lifecycle

生命周期：

```text
create
↓
construct core services
↓
load plugin dependencies
↓
plugin.init()
↓
all plugins initialized
↓
plugin.ready()
↓
editor ready
↓
normal usage
↓
destroy()
↓
plugin.destroy()
```

必须保证：

```text
ready()
```

只有所有 plugin.init() 完成后才调用。

---

# 16. Plugin

实现：

```ts
export interface PluginConstructor<
    T extends Plugin = Plugin
> {
    new(context: PluginContext): T;

    readonly id: string;

    readonly requires?:
        readonly PluginConstructor[];
}
```

Plugin：

```ts
export abstract class Plugin {

    protected readonly editor: Editor;

    constructor(
        context: PluginContext
    ) {
        this.editor = context.editor;
    }

    init?():
        void | Promise<void>;

    ready?():
        void | Promise<void>;

    destroy?():
        void | Promise<void>;
}
```

---

# 17. PluginManager

负责：

- 注册 Plugin
- Resolve dependencies
- Plugin order
- 去重
- lifecycle
- 获取 Plugin instance
- Circular dependency detection

API：

```ts
editor.plugins.has('plugin-id');

editor.plugins.get('plugin-id');

editor.plugins.get(MyPlugin);
```

如果 Plugin 不存在：

```text
get()
```

应抛明确错误。

另外提供：

```ts
editor.plugins.tryGet(...)
```

不存在返回：

```ts
undefined
```

---

# 18. Plugin Dependency Rules

例如：

```ts
class PluginA extends Plugin {
    static id = 'a';
}

class PluginB extends Plugin {
    static id = 'b';

    static requires = [
        PluginA
    ];
}
```

用户：

```ts
plugins: [
    PluginB
]
```

最终加载：

```text
PluginA
PluginB
```

不要要求用户手动加入 PluginA。

如果：

```text
A requires B
B requires A
```

必须抛：

```text
PluginDependencyCycleError
```

错误中显示：

```text
a -> b -> a
```

---

# 19. Plugin ID

必须唯一。

如果：

```text
PluginA.id = image
PluginB.id = image
```

但 Constructor 不同：

必须报错。

不要静默覆盖。

---

# 20. Command

定义：

```ts
export interface CommandContext {
    readonly editor: Editor;
}

export interface Command {
    readonly id: string;

    execute(
        context: CommandContext,
        ...args: readonly unknown[]
    ): unknown | Promise<unknown>;

    canExecute?(
        context: CommandContext
    ): boolean;

    isActive?(
        context: CommandContext
    ): boolean;
}
```

不要做 abstract class。

优先 interface。

---

# 21. CommandRegistry

API：

```ts
editor.commands.register(command);

editor.commands.unregister(id);

editor.commands.has(id);

editor.commands.get(id);

editor.commands.canExecute(id);

editor.commands.isActive(id);

editor.commands.execute(
    id,
    ...args
);
```

Editor：

```ts
editor.execute(
    id,
    ...args
);
```

只是代理：

```text
CommandRegistry.execute()
```

---

# 22. Command Event

Command 执行前：

```text
command:beforeExecute
```

执行后：

```text
command:afterExecute
```

如果出错：

```text
command:error
```

Event payload 至少包含：

```ts
{
    commandId,
    args
}
```

error event 包含：

```ts
{
    commandId,
    args,
    error
}
```

不要吞掉异常。

Event 发出后：

```text
throw original error
```

---

# 23. EventBus

不要使用 Node.js：

```text
EventEmitter
```

自己实现小型 typed EventBus。

要求：

```ts
const dispose = editor.events.on(
    'document:change',
    listener
);

dispose();
```

也支持：

```ts
editor.events.once(...);

editor.events.emit(...);
```

不要过度设计 wildcard。

不要实现：

```text
*
document:*
```

本阶段不需要。

---

# 24. Core Events

定义：

```text
editor:ready
editor:destroy

document:beforeChange
document:change

state:change

mode:change

command:beforeExecute
command:afterExecute
command:error

plugin:error
```

事件名统一：

```text
namespace:event
```

---

# 25. document:change

只有 Document Source 真正发生变化时触发。

Payload：

```ts
{
    previous: EditorDocument;

    current: EditorDocument;

    transaction: Transaction;
}
```

如果：

```text
source A
replaceDocument A
```

内容没有变化：

不要增加 revision。

不要触发 document:change。

---

# 26. state:change

任何 EditorState 实际变化都触发。

包括：

```text
document
mode
readonly
dirty
```

Payload：

```ts
{
    previous: EditorState;

    current: EditorState;

    transaction?: Transaction;
}
```

---

# 27. ServiceRegistry

实现：

```ts
editor.services.register(
    'example',
    instance
);

editor.services.has(
    'example'
);

editor.services.get<T>(
    'example'
);

editor.services.tryGet<T>(
    'example'
);

editor.services.unregister(
    'example'
);
```

如果重复 register：

默认报错。

不要覆盖。

另外支持：

```ts
replace()
```

显式替换。

---

# 28. Typed Service Token

为了长期避免字符串冲突，优先设计：

```ts
export interface ServiceToken<T> {
    readonly id: string;
}
```

例如：

```ts
const ExampleService =
    createServiceToken<Example>(
        'example'
    );
```

使用：

```ts
editor.services.register(
    ExampleService,
    service
);

const service =
    editor.services.get(
        ExampleService
    );
```

同时可以保留 string API。

如果实现会明显增加复杂度：

第一阶段可以只做 typed token。

优先 typed token。

---

# 29. Configuration

实现简单 typed Config。

```ts
export interface EditorConfig {
    readonly [key: string]: unknown;
}
```

提供：

```ts
editor.config.get<T>(
    key
);

editor.config.has(
    key
);
```

需要支持 dotted path：

```text
preview.css
toolbar.items
```

例如：

```ts
editor.config.get(
    'preview.css'
);
```

暂时不实现：

```text
defaults
preset
global config
```

只实现 instance config。

---

# 30. Config Immutable

用户传入：

```ts
config
```

后不能被内部修改。

需要 defensive copy 或 freeze。

不要修改用户原对象。

---

# 31. Errors

建立：

```text
packages/core/src/errors/
```

至少：

```ts
SoEditorError

EditorDestroyedError

CommandNotFoundError

CommandAlreadyRegisteredError

PluginNotFoundError

PluginDuplicateIdError

PluginDependencyCycleError

ServiceNotFoundError

ServiceAlreadyRegisteredError
```

所有 error message：

- 清晰
- 可搜索
- 包含 ID
- 不使用模糊 wording

例如：

```text
Command "image.insert" is not registered.
```

而不是：

```text
Command error.
```

---

# 32. Destroy

调用：

```ts
editor.destroy()
```

后：

- plugin.destroy() 按逆序执行
- events 清空
- command registry 清空
- service registry 清空
- editor 标记 destroyed

重复：

```ts
destroy()
```

应该安全。

可以：

```text
no-op
```

不要报错。

Destroy 后调用：

```ts
execute
setData
update
dispatch
```

必须抛：

```text
EditorDestroyedError
```

---

# 33. Plugin Destroy Order

加载：

```text
A
B
C
```

destroy：

```text
C
B
A
```

保证 dependency 后销毁。

---

# 34. Error Isolation

如果：

```ts
plugin.destroy()
```

一个 Plugin 报错：

其他 Plugins 仍然继续 destroy。

最终 destroy：

- 收集 errors
- emit plugin:error
- 完成所有 cleanup

本阶段可以：

```text
console.error
```

但优先不要直接依赖 console。

通过：

```text
plugin:error
```

提供。

---

# 35. Playground

建立：

```text
apps/playground
```

仅做开发验证界面。

不需要漂亮 UI。

可以有：

```text
SoEditor Core Playground

Current State
JSON

Buttons:

Set Hello
Set World
Toggle Source Mode
Mark Clean
Execute Demo Command
```

使用：

```ts
Editor.create(...)
```

验证 API。

不要加入真正 editing UI。

---

# 36. Demo Plugin

Playground 可以建立：

```ts
class DemoPlugin extends Plugin
```

注册：

```text
demo.uppercase
```

Command。

例如：

```text
Hello
↓
demo.uppercase
↓
HELLO
```

必须通过：

```text
Command
↓
Transaction
↓
Document
```

而不是直接修改 state。

---

# 37. Unit Tests

Core 必须建立完整 tests。

至少覆盖：

## Editor

- create
- initial state
- getData
- setData
- markClean
- destroy

## Transaction

- replace document
- set mode
- revision
- dirty
- no-op transaction

## Command

- register
- duplicate
- execute
- missing
- canExecute
- events
- error propagation

## Plugin

- load
- dependencies
- duplicate
- cycle
- init order
- ready order
- destroy reverse order

## EventBus

- on
- once
- dispose
- emit

## ServiceRegistry

- register
- get
- missing
- duplicate
- unregister
- replace

## Config

- get
- dotted path
- immutable input

目标：

```text
packages/core
```

核心逻辑测试覆盖率：

**90%+**

不要为了覆盖率写无意义测试。

---

# 38. Public API

所有 public API 从：

```ts
packages/core/src/index.ts
```

显式 export。

不要：

```ts
export * from './everything';
```

随意暴露 internal API。

目录：

```text
src/
├─ editor/
├─ state/
├─ transaction/
├─ commands/
├─ plugins/
├─ services/
├─ events/
├─ config/
├─ errors/
├─ internal/
└─ index.ts
```

`internal/` 不允许从 package root export。

---

# 39. API Documentation

Public interface 写 TSDoc。

例如：

```ts
/**
 * Executes a registered editor command.
 *
 * @throws {CommandNotFoundError}
 * When the command is not registered.
 */
```

不要给 trivial private method 写冗余注释。

---

# 40. Coding Rules

必须：

```text
small classes
single responsibility
dependency injection
immutable state
explicit public API
```

避免：

```text
God object
static global registry
singleton
global mutable state
```

尤其禁止：

```ts
SoEditor.plugins = ...
```

作为核心 PluginManager。

每个 Editor instance：

```text
独立 plugins
独立 commands
独立 services
独立 events
```

未来 CDN global registration 属于另一个 package 层，不属于 Core。

---

# 41. Browser Global

本阶段不要实现：

```js
window.SoEditor
```

不要实现 UMD global registration。

当前只建立：

```text
ESM packages
```

CDN build 在后续 milestone 处理。

---

# 42. Package Build

`@soeditor/core` 应输出：

```text
dist/
├─ index.js
├─ index.d.ts
└─ *.map
```

package.json 正确设置：

```json
{
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.js"
        }
    }
}
```

支持 tree-shaking：

```json
{
    "sideEffects": false
}
```

---

# 43. engine Package

`@soeditor/engine` 当前只建立：

```ts
export interface EditingEngine {
    destroy(): void;
}
```

以及 README / package structure。

不要写任何真正实现。

其目的只是提前保留 package 边界。

---

# 44. Architecture Document

创建：

```text
docs/architecture.md
```

写明：

## Core Principles

```text
HTML-first
Plugin-first
Command-driven
Immutable state
Transaction-based
Framework agnostic
```

并明确：

```text
@soeditor/core
```

不能依赖：

```text
DOM
UI framework
CodeMirror
Prettier
Markdown
```

---

# 45. README

Root README 应说明：

```text
SoEditor

Developer-first extensible content editor.
```

明确写：

```text
Status: early development
```

不要宣称：

```text
production ready
```

示例：

```ts
import {
    Editor
} from '@soeditor/core';

const editor =
    await Editor.create({
        data: '<p>Hello</p>'
    });
```

---

# 46. Git

建立：

```text
.gitignore
.editorconfig
```

如果 repo 尚未初始化：

初始化 Git。

初始 commits 可以拆成：

```text
chore: bootstrap monorepo

feat(core): add editor state and transactions

feat(core): add command registry

feat(core): add plugin system

feat(core): add event and service registries

test(core): cover core architecture

docs: add architecture documentation
```

不要创建一个巨大：

```text
initial commit
```

如果当前环境方便进行多个 commit。

如果不方便，至少保证工作树清晰。

---

# 47. Verification

完成后必须运行：

```bash
pnpm install

pnpm lint

pnpm typecheck

pnpm test

pnpm build
```

全部必须通过。

如果失败：

修复。

不要留：

```text
TODO fix test
```

---

# 48. 禁止行为

禁止：

```text
为了快速实现使用 any
```

禁止：

```text
为了测试通过降低 strictness
```

禁止：

```text
提前实现 UI
```

禁止：

```text
引入 React
```

禁止：

```text
引入 CodeMirror
```

禁止：

```text
引入 HTML parser
```

禁止：

```text
复制 CKEditor / VSCode 源码
```

可以学习公开架构思想，但必须独立实现。

---

# 49. 决策原则

如果遇到不明确的问题：

优先选择：

```text
简单
可扩展
稳定 public API
小 core
低耦合
```

而不是：

```text
功能丰富
复杂 abstraction
未来可能有用
```

遵循：

> Do not design for hypothetical requirements unless the current architecture clearly requires the extension point.

---

# 50. 完成后的输出

最终给出：

## 1. Summary

说明完成了什么。

## 2. Architecture

说明：

```text
Editor
State
Transaction
Command
Plugin
Event
Service
```

如何协作。

## 3. File Structure

给出主要目录。

## 4. Public API

列出主要 API。

## 5. Tests

说明测试数量和覆盖情况。

## 6. Verification

列出：

```text
lint
typecheck
test
build
```

结果。

## 7. Deferred Features

明确说明本阶段没有实现：

```text
Visual editor
Toolbar
CodeMirror
Markdown
Preview
```

## 8. Architecture Concerns

如果发现当前设计存在潜在问题，列出来。

不要因为任务已经完成而隐藏设计风险。

---

# Final Goal

本阶段完成后，以下代码应该工作：

```ts
import {
    Editor,
    Plugin
} from '@soeditor/core';

class UppercasePlugin extends Plugin {

    static id = 'uppercase';

    init() {

        this.editor.commands.register({
            id: 'document.uppercase',

            execute: ({ editor }) => {

                editor.update(
                    transaction => {

                        transaction.replaceDocument(
                            editor
                                .getData()
                                .toUpperCase()
                        );

                    },
                    {
                        origin: 'command'
                    }
                );
            }
        });
    }
}

const editor =
    await Editor.create({
        data: '<p>Hello</p>',

        plugins: [
            UppercasePlugin
        ]
    });

editor.events.on(
    'document:change',
    event => {
        console.log(
            event.current.source
        );
    }
);

editor.execute(
    'document.uppercase'
);

console.log(
    editor.getData()
);

// <P>HELLO</P>
```

整个 Core 的存在，就是为了让这类代码：

- 简单
- 可预测
- 可测试
- 可扩展
- 与任何 UI 框架无关

如果为了实现其他功能需要破坏以上核心原则，请停止实现该功能，而不是修改核心边界。