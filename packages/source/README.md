# @soeditor/source

CodeMirror 6 HTML Source editing for SoEditor. The surface preserves exact
canonical source, projects parser diagnostics, shares Core history, and exposes
only SoEditor-owned focus/search/range capabilities. CodeMirror types are not
part of the public package API.

Source defaults to a light theme. A color-scheme selector at the top of the Source
surface switches immediately between light and dark, including completion
popups, a high-contrast caret, focused outline and active-line/gutter cues.
The choice belongs to the current editor instance and survives view changes;
it resets when that instance is recreated. It does not change canonical HTML,
selection, shared undo history or the lazy-loading boundary. Labels follow the
nearest HTML `lang` attribute (Chinese or English).

Parser diagnostics are cached by exact source. Lint markers update after a
300 ms idle interval, while explicit diagnostic requests, including Classic's
save guard, validate the latest source synchronously.

Classic Source keeps configured Undo, Redo and Reset edits toolbar controls
visible, alongside Source-specific tools. It shares the canonical history with
WYSIWYG; history mutations are unavailable while the editor is readonly.

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
