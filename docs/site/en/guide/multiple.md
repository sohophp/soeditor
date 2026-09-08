---
title: 'Multiple instances'
description: 'Each instance owns its content, history, selection, services and tasks. Use a separate host and retain a separate handle for each editor.'
---

# Multiple instances

Each instance owns its content, history, selection, services and tasks. Use a separate host and retain a separate handle for each editor.

During teardown, stop application listeners, await every instance’s `destroy()`, then remove the hosts. If initialization partially fails, destroy already-created instances too.

[Run the two-instance teardown example](/en/examples/multiple).

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
