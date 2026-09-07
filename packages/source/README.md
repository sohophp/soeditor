# @soeditor/source

CodeMirror 6 HTML Source editing for SoEditor. The surface preserves exact
canonical source, projects parser diagnostics, shares Core history, and exposes
only SoEditor-owned focus/search/range capabilities. CodeMirror types are not
part of the public package API.

Applications with a nonce-based `style-src` policy pass the request nonce as
`cspNonce` when creating the source engine. SoEditor forwards it to
CodeMirror's generated style element.

Classic integrations can opt into proportional split-pane scroll mirroring
with `source: { scrollSync: true }`. It is disabled by default, runs only while
both WYSIWYG and Source are visible, and does not change selection or canonical
HTML.

Classic CMS consumers use `@soeditor/editor/cms/optional` with
`@soeditor/editor/cms/styles.css`. Configuring Source does not load CodeMirror
until Source or a Source split view is first activated. Formatting and Preview
remain separate first-use imports.

The `@soeditor/source/recovery` entry supports Classic's failed-load recovery.
Its self-contained `runtime.js` asset is fetched only on retry; each retry uses a
distinct URL. Keep emitted assets reachable under the consumer's deployment base
and allow their origin in `script-src`. The package includes its hidden source
map and bundled dependency notices. Installed storage therefore includes a
recovery copy, while ordinary Source activation downloads only the normal graph.
