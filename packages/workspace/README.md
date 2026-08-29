# @soeditor/workspace

Private Phase 30 framework-neutral application lifecycle for SoEditor.

`createEditorWorkspace()` receives an explicit editor creator and ordered
attachment factories. It never discovers DOM, creates global registries, or
chooses surfaces for the host. Attachments are destroyed in reverse order and
the Editor is destroyed last.

The controller supports controlled values with feedback-loop suppression,
uncontrolled initial values, transaction-level change notification, and
opt-in bounded recovery from the last observed canonical source. Recovery is
triggered explicitly with `reportFailure()`; it cannot infer every application
or rendering failure.

See [`docs/workspace.md`](../../docs/workspace.md).
