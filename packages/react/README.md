# @soeditor/react

Public 0.9 React lifecycle adapter for `@soeditor/workspace`.

`useSoEditorWorkspace()` mounts after commit, serializes StrictMode cleanup and
remount, applies controlled value and readonly prop updates without rebuilding,
and can surface asynchronous mount failures to an Error Boundary with
`throwOnError`.

See [`docs/framework-adapters.md`](../../docs/framework-adapters.md).
