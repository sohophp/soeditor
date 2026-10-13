# CMS UI localization

Classic supports built-in English, Simplified Chinese and Traditional Chinese.
Pass `locale: 'en'`, `locale: 'zh-CN'` or `locale: 'zh-TW'` to editor creation.
Chinese aliases normalize to the corresponding built-in locale. Other languages
use host-supplied `translations` resources; callers may also override built-in
labels. Each editor owns its locale and direction.

The 2026-10-09 audit, extended on 2026-10-10, covers the active CMS toolbar, image insertion choices,
link and color panels, character tools, table properties and captions, optional
video controls, upload controls, confirmation messages, popup preview and HTML
Source controls. Literal label coverage is checked with
`node scripts/check-ui-locales.mjs`. Technical values such as HTML tags, CSS units,
URLs, filenames, attribute values and parser error codes remain unchanged.
External adapters and contributed labels or errors belong to the host resources.
Historical Developer Visual and other non-CMS compatibility products are outside
this audit.

Image choices now read “从电脑上传／从文件管理器插入／通过网址插入” in
Simplified Chinese and “從電腦上傳／從檔案管理員插入／透過網址插入” in
Traditional Chinese. Table and video dialogs use English source keys for every
locale, including validation messages. Source inherits its Classic instance
language for search, replacement, accessibility labels and color selection.
Source language resources load only with Source. Table context resources retain
the existing standalone build boundary. No runtime dependencies were added.

Verification at the 2026-10-09 snapshot: 227 literal CMS UI keys have resources; 29 unit
cases, affected-package types/builds, changed-file lint/format and 24 public API
entry reports passed. Public export signatures remain unchanged; the report
records new internal declaration files. Three Chromium language workflows opened
actual image, color, video, table validation, Source search and popup controls
without changing the initial HTML. Twelve Source regressions and eighteen video,
locale and toolbar cases passed; the complete CMS showcase also passed after its
menu expectations were corrected to Chinese. Earlier fixture initialization and
menu timing failures were corrected, not counted as acceptance. Firefox, WebKit,
authenticated CMS saves and manual Windows validation were not run this stage.

Build measurements: Source index gzip 14.49 kB; standalone global 486.67 kB raw /
149.60 kB gzip, within the existing 500 / 150 kB limits. Built-in UI dictionaries
stay outside English ESM startup. Source and optional dialog loading boundaries
remain covered by the regressions above.

Follow-up on 2026-10-10: generic insertion dialogs previously constructed an
English action label at runtime. They now translate `Insert {item}` and the item
label using their own UI resources; named-anchor actions show “插入命名锚点” or
“插入命名錨點”. The literal audit includes current CMS rich-text command sources
(246 keys, no missing built-in resources), while three Chromium workflows cover
the generated anchor action and cancellation without changing initial HTML.
Twelve UI unit cases and editor type checking passed. Untitled video cards now
receive their instance translation after the initial toolbar mounts; preview
uses English resource keys for both Chinese variants. Table column ranges and
paste failure prefixes also use translation resources, leaving external details
and stored titles unchanged. Initial tests wrongly requested a placeholder
toolbar entry and advanced column controls excluded from the current CMS build;
those fixture errors were corrected and are not counted as acceptance.

The affected UI and Editor builds, twenty unit cases, changed-file lint/format
and all twenty-four public API entry reports passed. The Editor standalone global
is 487.15 kB raw / 149.70 kB gzip; existing budgets remain unchanged. CoreRepo
consumption and HTTP evidence are documented by the integration host separately.
No public release or manual Windows acceptance was performed.
