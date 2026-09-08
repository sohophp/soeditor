---
title: 'Saving and dirty state'
description: 'Connect an Ajax save adapter and handle pending requests, failures, retry and dirty state.'
---

# Saving and dirty state

Use `/cms/optional` and configure `save.adapter.save`. It receives canonical `source`, a revision token and an `AbortSignal`. Return `{ status: 'saved', revisionToken }` on success, throw on failure, or return `status: 'conflict'` for a server revision conflict handled by the host.

Call `save()` to save and `retrySave()` to retry. Read dirty and request state through `save.onStateChange`. Edits made while a request is pending remain dirty after an older payload is saved.

Autosave is opt-in and disabled in this demo. Destruction cancels owned save work. [Try failure and retry](/en/examples/save).

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
