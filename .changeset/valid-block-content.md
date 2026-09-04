---
'@soeditor/wysiwyg': patch
---

Prevent block-format commands from creating invalid nested flow content such as
`<p><p>…</p></p>`, while preserving block order, attributes, and PRE line breaks.
Ignore temporary selection markers when deciding whether surrounding whitespace
requires a paragraph.
