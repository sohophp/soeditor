# @soeditor/rich-text

Independent command plugins for SoEditor's visual schema: paragraphs, headings,
inline and multi-block formatting, nested lists, semantic CMS styles,
blockquote/code, links, images, bounded structured
tables, and safe figure/media widgets. Plugins delegate document mutation to
the typed visual-editing service; toolbar and host code invoke the same
commands.

`FontPlugin` adds command-backed `font.color`, `font.backgroundColor`, and
`font.size` inline styling. Values pass through bounded color and size
validation before the Visual editing service creates semantic source spans;
toolbar controls never mutate projected DOM directly.

`SemanticStylesPlugin` reads validated per-instance definitions from
`cms.styles`. Inline definitions may use `span`, `mark`, `small`, or `kbd`;
block definitions may select a supported semantic block; structured
definitions target a registered object type. Attributes are bounded and reject
event handlers, executable URLs, and CSS outside the explicit
color/background/font/size allowlist.

`LinkPlugin` applies an instance-scoped `cms.links` scheme policy, normalizes
safe target/rel values, and accepts optional internal/file targets through
`linkTargetProviderServiceToken`. `CmsObjectsPlugin` registers bounded atomic
objects from `cms.objects` plus named anchors, page breaks, placeholders, and
safe metadata-only embeds through `cmsEmbedProviderServiceToken`. Provider HTML
is never inserted or executed.

`TablePlugin` supports bounded table/row/cell properties, semantic sections,
header scope, captions, responsive metadata, and accessible column resizing.
External cell matrices pass through the editor paste pipeline and an
execution-safe cell allowlist; internal matrices retain versioned clipboard
fidelity. Controlled list operations split, merge, outdent, and exit empty
items without relying on browser DOM normalization.
