# Configuration

## Current loading behavior

In the WYSIWYG + Source worktree, configuring `editingModes: ['wysiwyg', 'source']`
only exposes the control. First entering Source or either Source split view loads
its runtime. `initialEditingMode: 'source'` loads it during creation. Await
`classic.setWorkspaceView('source')` when subsequent host code needs the surface.
Formatting/minification loads its implementation on use, and popup Preview loads
on the first preview request. The synchronous `openPreview()` result reports
whether a popup was reserved; asynchronous loading errors reach `onError`.

Invalid Source drafts stay in `getData()` and the textarea; native form submission
is canceled and save adapters are not invoked until the source is repaired.
`onError` or the save rejection reports an error named `ClassicInvalidSourceError`.
If Source loading fails, select Source again to retry. Recovery uses a separate
self-contained module with a per-attempt URL, requested only after failure. Deploy
the generated recovery asset alongside the other chunks; `script-src` must allow
its origin. This increases installed assets, not normal startup requests. See
[current evidence](wysiwyg-source-evidence.zh-CN.md).

## Classic CMS options

Source, Preview and save adapters require the explicit optional CMS entry. It
keeps Core configuration separate from browser UI, form, and persistence
options:

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';

const classic = await createClassicEditor(textarea, {
    ariaLabel: 'Article body',
    autoGrow: true,
    editingModes: ['wysiwyg', 'source'],
    initialEditingMode: 'wysiwyg',
    config: {
        cms: {
            paste: { policy: 'semantic' },
            specialCharacters: ['©', '®', '™', '€', '→', '✓'],
            styles: [
                {
                    attributes: [{ name: 'class', value: 'lead' }],
                    element: 'span',
                    id: 'lead',
                    label: 'Lead',
                    target: 'inline',
                },
            ],
        },
    },
    icons: { 'format.bold': 'B' },
    locale: 'zh-CN',
    minHeight: 240,
    preview: {
        initialTemplateId: 'website',
        templates: [
            {
                id: 'website',
                label: 'Website article',
                template:
                    '<!doctype html><html><body><main class="article">{{ content }}</main></body></html>',
                styles: ['.article { max-width: 72rem; margin: auto; }'],
                title: 'Article preview',
            },
        ],
    },
    save: {
        adapter: articleSaveAdapter,
        autoSaveDelay: 1500,
        leavePageProtection: true,
    },
    source: {
        autoFormat: true,
        autoFormatDelay: 300,
    },
    themeVariables: { accent: '#005ea8', focusRing: 'CanvasText' },
    toolbar: ['heading', 'bold', 'italic', 'link'],
    unsupportedContentDisplay: 'detailed', // Developer Visual only
});
```

`editingModes` controls which authoring engines are mounted. Use
`['wysiwyg', 'source']` for a normal CMS editor, or
`['visual', 'source']` for the Developer Visual workflow. When both visual
engines are enabled, WYSIWYG remains the command-facing writer and the
coordinator enforces one active writer. `initialEditingMode` must be one of the
enabled modes. Developer Visual can show unsupported HTML using `detailed` or
`compact` presentation and exposes that choice in its toolbar. WYSIWYG never
shows source labels or `Edit HTML` controls for preserved nodes. Set
`cms.specialCharacters` to a custom list or `false` to disable its preset
palette.

ClassicEditor 的作者工具栏保持紧凑，不显示撤销、重做、分页符、特殊字符、CMS 占位符、源码、源码查找替换、保存和工具栏折叠按钮。这些底层命令及快捷键仍可供集成使用；源码通过编辑视图切换按钮进入，保存由宿主页面按钮、自动保存或 `save()` API 触发。预览、帮助、编辑视图和最大化组成独立末组，在工具栏正常流中靠右对齐并随可用宽度自然换行。

可在 `/cms/optional` 的自定义工具栏中加入 `showBlocks`，以切换仅存在于
WYSIWYG 投影中的区块边界和 `p`、`div`、`h1` 等标签名称；该状态不会进入规范
HTML。Classic 状态栏包含编辑模式、保存状态、当前元素路径和字数统计，默认位于
内容区下方，与传统 CMS 编辑器的布局一致。

SoEditor 对话框使用固定的标题、可滚动正文和底部操作区。Classic 可选构建中，
可拖动标题在视口内移动窗口，也可拖动右下角调整宽高；调整手柄获得焦点后可用
方向键精确调整。窗口始终保留在当前视口范围内，并在浏览器尺寸变化时重新约束
位置与大小。

`setWorkspaceView()` accepts `wysiwyg`, `source`,
`wysiwyg-source-horizontal` (left/right), and
`wysiwyg-source-vertical` (top/bottom). The two Source-enabled split views use
one keyboard-accessible separator with a bounded 20%–80% ratio. The Classic
toolbar presents these arrangements as four labeled icon buttons: WYSIWYG,
Source, side-by-side, and stacked. The active button exposes `aria-pressed`.
Popup Preview is an optional, separately loaded output surface and does not add
another editing projection or arbitrary workspace composition.

Set `preview: true` to add the popup Preview tool with the same content CSS and
style preset as WYSIWYG. The popup always offers built-in Web page, 600 px Email
newsletter, and A4-like Word document visual templates; Web page is the default.
These are presentation previews only: they do not provide email-client
compatibility, CSS inlining, sending, `.docx` editing, or Word export.

A configuration object additionally accepts the safe
Preview package fields `template`, `styles`, `stylesheets`, `baseUrl`,
`context`, and `title`; the template must contain exactly one `{{ content }}`
marker. `templates` appends named choices with stable lowercase IDs, and
`initialTemplateId` selects the initial built-in or custom choice. Set
`wysiwygStyles: false` when a site template supplies all CSS, and use
`windowFeatures` to choose the popup dimensions. Preview remains live while open.
Repeated requests from one editor focus and refresh that editor's existing
window, while different editor instances receive independent windows. The content
runs in a script-disabled sandbox iframe. `openPreview()` exposes the same action
to host code and returns `false` when the browser blocks the popup.

The standalone CMS global and ESM `/cms` entry are deliberately WYSIWYG-only
and reject Source, popup Preview and save-adapter configuration. Use
`@soeditor/editor/cms/optional` for those capabilities. All three surfaces use
the narrow CMS runtime preset without host-owned file-manager/upload plugins;
pass `cmsPreset` explicitly when those integrations are required.

`source.autoFormat` debounces WYSIWYG-originated changes and formats the
canonical HTML in the formatter worker, so a visible split Source pane follows
the visual edit without formatting on every keystroke. Formatting is also scheduled when the first split view attaches if a visual
edit occurred during loading. Merely switching views does not reformat content. It does not start
during WYSIWYG-only startup. Source-originated edits
are never automatically reformatted. `autoFormatDelay` defaults to 300 ms and
accepts 0–10000 ms; `source.formatting` accepts the same options as the explicit
`document.format` command. CodeMirror applies synchronized updates as the
smallest changed range, preserving its selection and scroll position when the
surrounding source remains unchanged.

In a split view, moving the WYSIWYG caret or selection also scrolls Source to
the corresponding parsed HTML text range without taking focus away from visual
editing. This mapping follows blocks, inline markup, Unicode text, and character
references. Source-to-WYSIWYG caret mapping is not currently enabled because a
CodeMirror selection cannot safely replace the active native visual selection
without changing the pane that owns focus.

`icons`, translations, theme variables, toolbar layout, sizing, callbacks, and
save behavior are owned by that editor instance. Theme/icon data affects chrome
only and is never serialized. The save adapter receives exact canonical source
and a revision; backend authorization and conflict policy remain host-owned.
See [Classic UI](classic-ui.md), [CMS saving](cms-saving.md), and the
[CMS plugin/theme guide](cms-plugin-ecosystem.md).

## Core editor options

`SoEditor.create()` accepts one instance-scoped object:

```ts
const editor = await SoEditor.create({
    data: '<p>Initial canonical source.</p>',
    format: 'html', // 'html' | 'markdown'
    mode: 'visual',
    readonly: false,
    plugins: classicPreset.plugins,
    config: {
        cms: { contentType: 'article' },
    },
});
```

`config` is defensively cloned immutable JSON-like application/plugin data.
Features read owned values through `editor.config.get('cms.contentType')`.
DOM nodes, functions, class instances, accessors, and cyclic values are not
configuration data.

State is immutable. Use commands for user actions and transactions (`update`,
`setData`) for application changes. `readonly` is an editing policy consumed by
surfaces and commands; it does not turn the Editor object into a passive data
container.

## Presets

Presets are frozen values. Extend without mutation:

```ts
import { developerPreset, extendPreset } from '@soeditor/presets';

const cmsPreset = extendPreset(developerPreset, {
    plugins: [CmsMetadataPlugin],
    toolbar: [...developerPreset.toolbar, '|', 'cms-metadata'],
});
```

Duplicate plugin IDs are rejected. Applications remain responsible for
registering concrete capabilities such as a `FileManager` and for attaching
surface hosts.

The Developer preset includes the bounded accessibility/SEO providers and the
projection/split services. It still does not construct engines, discover DOM
hosts, attach a split layout, or select Preview security policy.

## Diagnostics

Validation is manual unless a per-editor debounced policy is configured:

```ts
config: {
    htmlTools: {
        diagnostics: { validation: { mode: 'debounced', delay: 250 } },
        accessibility: {
            rules: {
                'a11y.interactive-name': 'error',
                'a11y.heading-order': false,
            },
        },
        seo: { rules: { 'seo.meta-description': 'hint' } },
    },
}
```

Use `editor.execute('document.validate')` for manual validation. Supported rule
settings are `false`, `error`, `warning`, `info`, and `hint`; malformed or
unknown settings fail initialization. Diagnostics inspect canonical source and
cannot prove WCAG conformance, search ranking, CSS/layout behavior, or dynamic
script output.

## Surface options

Surface configuration is deliberately separate from Core:

- Visual: `{ editor, element, ariaLabel? }`.
- HTML Source: `{ editor, element, ariaLabel?, cspNonce? }`.
- Markdown: `{ editor, element, ariaLabel?, cspNonce? }`.
- UI: `{ editor, element, toolbar?, theme?, themeVariables?, icons?, locale?, translations? }`.
- Preview: `{ editor, element, renderer?, configuration? }`.
- Developer tools: `{ editor, ui, visualElement }`.
- Split layout: `{ editor, element, hosts, initialPair, orientation?, ratio?,
responsiveBreakpoint? }`.

Only one service-owning surface of each kind may attach to an editor. Duplicate
attachment fails before taking over an existing host.

`cspNonce` forwards an application-generated response nonce to CodeMirror's
runtime style element. Omit it when the host CSP does not use style nonces; an
empty nonce is rejected.

Split layout pairs are `visual-source`, `source-preview`, and
`markdown-preview`. Projection engines remain application-owned. Destroy the
layout before destroying those engines so hosts are restored to their original
DOM positions. Invalid HTML stays Source-owned and locks Visual at its last
valid model; Preview and every non-primary editing projection are readonly.

## Commands and events

Use `editor.execute(commandId, argument?)` from buttons, menus, shortcuts, and
host integrations. Inspect `editor.commands.ids()` for a frozen discoverable
snapshot. Important events include `document:change`, `state:change`,
`mode:change`, and `editor:destroy`; dispose subscriptions you create.
