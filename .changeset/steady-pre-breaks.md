---
'@soeditor/html': patch
'@soeditor/wysiwyg': patch
---

Serialize line breaks as canonical `<br />` tags; keep Enter, Shift+Enter, and
plain-text insertion inside `pre` as literal newline text; and convert between
newline text and `br` elements when switching `pre` and `p`/`div` blocks. Block
commands now paragraphize selected legacy root-level inline content on demand.
