---
title: 'Paste'
description: 'External paste performs semantic cleanup, including common web and Office content. Plain-text paste is available when only text is wanted.'
---

# Paste

External paste performs semantic cleanup, including common web and Office content. Plain-text paste is available when only text is wanted.

Load stored CMS HTML with `setData()`, rather than reprocessing it as external paste. Unknown, invalid and unsafe HTML are distinct states and should not be treated as one deletion category.

Image paste requires an upload adapter. Test the actual Word, spreadsheet and browser sources used by your authors; automation does not qualify every Office version.

## 1.5.0: choose each paste format

After upgrading to 1.5.0, enable external rich-paste choices with `config: { cms: { paste: { prompt: true } } }`. This is off by default, so existing integrations keep automatic semantic cleanup.

- **Keep formatting** preserves available structure, classes and safe styles while filtering unsafe scripts, handlers and URLs.
- **Clean formatting** follows the host semantic policy and `retainStyles` / `retainAlignment` settings.
- **Text only** inserts clipboard text; HTML source copied as plain text remains visible code instead of interpreted tags.

Ordinary text, internal copies and files keep their existing paths. Cancel or Escape leaves content unchanged; confirmation creates one undoable operation. Content replacement, mode changes, readonly, another paste or destruction invalidate a pending choice. Choices never change the host default policy.

External CSS absent from the clipboard cannot be imported automatically, so preservation does not reproduce an entire website design. The dialog loads on demand and never executes clipboard HTML.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
