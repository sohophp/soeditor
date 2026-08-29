# Workspace lifecycle and recovery

Phase 30 provides the private `@soeditor/workspace` application layer. It
coordinates an Editor and explicit surface/service handles without owning DOM
selection or introducing React, Vue, or another framework.

```ts
import { Editor } from '@soeditor/core';
import { createVisualEditingEngine } from '@soeditor/engine';
import { minimalPreset } from '@soeditor/presets';
import { createEditorUi } from '@soeditor/ui';
import { createEditorWorkspace } from '@soeditor/workspace';

const workspace = await createEditorWorkspace({
    createEditor: ({ source }) =>
        Editor.create({
            data: source,
            format: minimalPreset.format,
            plugins: minimalPreset.plugins,
        }),
    attachments: [
        {
            id: 'visual',
            attach: ({ editor }) =>
                createVisualEditingEngine({ editor, element: visualHost }),
        },
        {
            id: 'ui',
            attach: ({ editor }) =>
                createEditorUi({
                    editor,
                    element: toolbarHost,
                    toolbar: minimalPreset.toolbar,
                }),
        },
    ],
    value: {
        initialValue: '<p>Hello</p>',
        kind: 'uncontrolled',
        onChange: ({ source }) => saveDraft(source),
    },
});
```

Factories run in declared order. Their handles run `destroy()` in reverse
order, followed by `editor.destroy()`. Startup failure cleans every completed
attachment. IDs must be unique. Hosts pass elements through closures; the
workspace never queries the document or claims ownership of caller DOM.

## Controlled and uncontrolled values

A controlled policy requires `value` and `onChange`. Call `setValue(source)`
when the owner supplies a new canonical value. Equal values are no-ops;
different external values use one marked Core transaction and do not feed back
into `onChange`.

If the owner updates a controlled value while recovery is mounting a new
instance, the workspace retains the latest value and applies it before the new
instance becomes ready. The failed instance never regains write authority.

Editor-originated changes update `lastKnownSource` synchronously, then invoke
`onChange` in a microtask. This prevents a parent that immediately echoes or
normalizes the value from causing reentrant Core dispatch. Notification is per
document transaction, so typing may produce one callback per character.

An uncontrolled policy accepts `initialValue` and an optional `onChange`.
Calling `setValue()` is rejected rather than silently changing ownership mode.

## Bounded recovery

Recovery is off by default. Enable it explicitly and report a fatal surface or
application error:

```ts
const workspace = await createEditorWorkspace({
    // creator, attachments, and value omitted
    recovery: { maxRestarts: 3, windowMs: 60_000 },
});

await workspace.reportFailure(error);
```

The workspace captures current canonical source, cleans the failed mount, and
recreates every resource from that exact source. Snapshots expose `status`,
`lastKnownSource`, `recoveryCount`, `revision`, and `error`. Cleanup failure,
restart failure, or exceeding the sliding restart limit produces `failed`
state; `editor` is then unavailable, but source evidence remains readable.

`AbortSignal` lets asynchronous factories stop work when destruction races a
restart. A handle that resolves after abort is destroyed immediately. Calling
`destroy()` is idempotent and produces a final `destroyed` snapshot.

This is bounded in-process recovery, not persistence. It cannot recover a
browser/process crash, another tab, unsaved network state, plugin-owned data
outside canonical source, or a failed backend. Applications must provide
durable drafts and deliberately decide which errors are fatal enough to report.

The executable demo is `/workspace.html`; add `?controlled=1` for controlled
value behavior.
