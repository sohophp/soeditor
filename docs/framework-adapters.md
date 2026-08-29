# React and Vue adapters

Phase 31 provides private `@soeditor/react` and `@soeditor/vue` packages over
the framework-neutral Workspace controller. They do not move React or Vue into
Core, engines, features, UI, SDK, or the umbrella package.

Both composables/hooks accept the same explicit Editor creator, ordered
attachments, controlled `value` or uncontrolled `initialValue`, recovery
policy, and runtime readonly policy. DOM elements remain application-owned and
are normally captured by refs inside attachment closures.

## React

`useSoEditorWorkspace()` mounts in an Effect and serializes cleanup before a
replacement mount. This is required because React StrictMode deliberately runs
an extra setup/cleanup cycle in development. Value and readonly changes update
the existing Workspace; a structural change requires a deliberate new
`configurationKey`. `throwOnError` rethrows an asynchronous mount failure on
render so the nearest Error Boundary can handle it.

The hook can render under Suspense, but does not suspend editor creation: DOM
refs must commit before attachment. Its initial/SSR status is `idle`.

## Vue

`useSoEditorWorkspace()` must be called synchronously from `setup()`. It creates
the Workspace only in `onMounted()` and destroys it in `onUnmounted()`. A
controlled value and readonly policy may be a ref, computed getter, or literal.
Initialization and cleanup failures are exposed through the returned `error`
ref and optional `onError` callback.

Neither adapter accesses DOM at module evaluation or during server rendering.
Node SSR tests prove that rendering does not call the Editor creator.

The executable comparison is `/framework-adapters.html`.
