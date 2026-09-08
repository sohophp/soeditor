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

## Optional toolbar drawers

The CMS default toolbar shows Strikethrough (`strike`), Subscript (`subscript`),
Superscript (`superscript`), and Remove format (`removeFormat`) as individual icon
buttons. To keep infrequent actions in a text drawer, place a drawer object in
`toolbar`:

```ts
const editor = await createClassicEditor(textarea, {
    toolbar: [
        'bold',
        'italic',
        'underline',
        {
            id: 'extraStyles',
            label: '更多文字样式',
            items: ['strike', 'subscript', 'superscript', 'removeFormat'],
        },
        '|',
        'link',
        'image-actions',
        'table',
    ],
});
```

`id` identifies the drawer; `label` is its accessible name and may be translated
through the usual UI translation resources. `items` lists registered toolbar
button IDs in order. Button commands, selection restoration, disabled/active
state, dialogs, keyboard navigation, and teardown remain owned by their original
implementations. Drawers accept command/dialog buttons, not separators or nested
menus such as `heading`, `alignment`, `image-actions`, or another drawer. Put
those menus directly on the toolbar. Keep each action in one location to avoid
duplicated controls. The existing `moreFormatting` string remains supported as
a fixed four-action drawer for compatibility.

## Optional Classic video

Video is an explicit optional import. It does not change the CMS preset or load
its dialog/player runtime during ordinary WYSIWYG startup. The runtime is loaded
on the first video action; existing videos render as inert cards without loading
a player. The historical structured `VideoPlugin` API remains supported.

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';
import { cmsPreset } from '@soeditor/presets/cms';
import { createCmsVideoPlugin } from '@soeditor/editor/video';

const editor = await createClassicEditor(textarea, {
    preset: cmsPreset,
    plugins: [
        ...cmsPreset.plugins,
        createCmsVideoPlugin({
            allowedMediaOrigins: ['https://assets.example.com'],
            youtube: true,
        }),
    ],
    toolbar: [...cmsPreset.toolbar, '|', 'cmsVideo'],
});
```

`plugins` replaces the preset plugin list, so retain `...cmsPreset.plugins`.
Include `cmsVideo` to mount the plugin's UI. It is an icon by default and can
instead be placed in a configured drawer:

```ts
const toolbar = [
    ...cmsPreset.toolbar,
    { id: 'extraMedia', label: 'More media', items: ['cmsVideo'] },
];
```

The dialog accepts direct video asset URLs and supported YouTube watch, short,
shorts and embed URLs. Native video provides a title, poster, pixel/percentage width,
aspect ratio, alignment, controls, mute, loop and a WebVTT subtitle track with
language/label. New videos default to controls on and autoplay off. Existing source alternatives, playback flags and authored layout are retained when those properties are not changed. A registered
`fileManagerServiceToken` supplies the existing SoFinder/application picker:
video uses `kind: 'media'`, poster uses `image`, subtitles use `file`. Return a
direct asset URL, not a download landing page. Upload and transcoding remain the
asset server's responsibility.

After a YouTube URL is entered, the dialog waits 350 ms and requests YouTube's
oEmbed JSON to fill an untouched title and cover URL. A Shorts URL suggests
`9:16`; other YouTube URLs suggest `16:9`. These are layout suggestions, not
measurements of the original video. Width keeps the responsive `100%` default;
alignment, subtitles and playback flags are not inferred. Existing values and
fields edited by the author (including intentionally emptied fields) are kept.
Changing URLs clears previously generated values and cancels stale requests.

Requests omit credentials, time out after five seconds and are canceled when
the dialog closes or the editor is destroyed. A failed lookup leaves manual
insertion available. No lookup runs merely because a stored video is displayed
or its properties are opened. Set `youtubeMetadata: false` in
`createCmsVideoPlugin` to disable lookups. A host CSP must allow
`connect-src https://www.youtube.com` for metadata and
`img-src https://i.ytimg.com` for the cover; a configured
`allowedMediaOrigins` must also include `https://i.ytimg.com` to accept that cover.
The provider endpoint is listed in the [oEmbed provider registry](https://oembed.com/providers.json).

YouTube cover URLs are saved as `data-soeditor-poster` on the iframe and used by
the inert editing card. The embedded YouTube player controls its own cover;
this attribute does not override YouTube's player. Provider-returned HTML is
never inserted or executed.

Select a card and use the video toolbar icon, double-click it, or focus it and
press Enter to edit. Delete/Backspace removes a focused card; shared block tools
insert a paragraph before or after it. Dialog confirmation and deletion use the
normal command/history path. Preview is a separate dialog and loads media only
on explicit request; closing it releases the player. A changed document or
read-only editor cannot be overwritten by an older dialog.

YouTube's video-properties preview uses a wider dialog and constrains portrait
players to the viewport. Its player has a minimum 200-pixel height, following
the [YouTube player sizing requirements](https://developers.google.com/youtube/player_parameters).
A loading message, reload button and direct YouTube watch link remain available
when an embedded player cannot load or play. Reload replaces the iframe; closing
the preview cancels its pending reminder and removes the player. An iframe load
event is not treated as proof of successful playback. The separate whole-article
preview keeps article scripts disabled. With `createCmsVideoPlugin()` enabled,
recognized YouTube embeds receive independent sandboxed players positioned over
their inert article placeholders. Players load when their article position enters the viewport, or when the author
activates the cover with the keyboard. Unchanged media reuse the same player
across text edits and template changes, preserving playback and article scroll.
Changed or removed media and closing the window release their players. Identical
media occurrences are matched in document order. Hidden or collapsed media do not
load until revealed. Native video receives the same persistent preview treatment;
media URLs are resolved against the article base and validated before loading. Unknown iframes and `srcdoc` remain
inert; `youtube: false` disables these players too. The explicit `@soeditor/preview/media` service entry lets
trusted optional plugins provide validated players without adding media code to
the default CMS startup. The service resolves a stable key, title, optional cover and a demand-created player
with explicit teardown. Never return arbitrary stored HTML from this service.

Both preview surfaces provide keyboard-operable reload and original-video links,
with loading and recovery messages. An iframe load event cannot certify playback.
The video properties dialog keeps URL, title, cover, dimensions and alignment
visible; native playback flags and subtitles are under the initially collapsed
"More settings" disclosure. YouTube hides this inapplicable group. Switching back
to a file retains the author's unsubmitted values.

Copy and cut transfer canonical media HTML, without the card's labels or controls.
Native dragging of a selection containing a media card is disabled to prevent
the browser from inserting the editing placeholder into the article; use cut
and paste to move these blocks.

Saved content is standard `video`/`track` or a constrained YouTube `iframe`, with
responsive inline layout declarations; published pages need no editor runtime.
Unknown embeds and unrelated CMS attributes/comments remain preserved and inert
in the authoring surface. No arbitrary embed HTML, scripts, audio or other
platform adapters are introduced. Same-origin asset URLs are allowed; remote
assets require HTTPS and, when configured, membership in `allowedMediaOrigins`.
YouTube uses a separate fixed provider allowlist and can be disabled. Site-side
HTML/CSP policy still governs rendering on published pages.

The Classic demo opts in at `/classic.html?video=1` (add `&test=1` for the browser
fixture). The normal `/classic.html` keeps its default request graph.

The video-enabled demo includes a locally generated three-second WebM test
pattern and a WebVTT subtitle fixture. Run `node scripts/measure-cms-video.mjs`
after building to verify the production import boundary, failure recovery and
150-card rendering/input measurements. `tests/browser/video.spec.ts` covers
native playback, canonical copy, source round-trips, undo, readonly and teardown
in Chromium, Firefox and WebKit. YouTube automation uses a controlled player
response; external platform playback depends on the deployment's network/CSP.

Adding subtitles supplies `crossorigin="anonymous"` unless the stored video
already declares a CORS mode. Video and WebVTT servers on another origin must
return the appropriate CORS headers; the editor does not proxy these requests.
