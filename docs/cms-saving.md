# CMS saving and persistence

SoEditor keeps persistence host owned. `EditorSaveAdapter` receives exact
canonical source, an opaque revision token, the Core document revision, the
save reason, an `AbortSignal`, and a bounded progress reporter. It never reads
the visual DOM.

## Classic editor

```ts
const editor = await createClassicEditor(textarea, {
    save: {
        adapter: {
            save: async ({ source, revisionToken, signal }) => {
                const response = await fetch('/api/articles/42', {
                    body: JSON.stringify({ source, revisionToken }),
                    headers: { 'content-type': 'application/json' },
                    method: 'PUT',
                    signal,
                });
                if (response.status === 409) {
                    const conflict = await response.json();
                    return {
                        message: 'The article changed on the server.',
                        revisionToken: conflict.revisionToken,
                        source: conflict.source,
                        status: 'conflict',
                    };
                }
                if (!response.ok)
                    throw new Error(`Save failed: ${response.status}`);
                const saved = await response.json();
                return { revisionToken: saved.revisionToken, status: 'saved' };
            },
        },
        autoSaveDelay: 1500,
        initialRevisionToken: textarea.dataset.revision,
        leavePageProtection: true,
    },
});

await editor.save();
```

The Save toolbar control appears only when a save adapter is configured.
Failures remain dirty and turn the control into Retry save. Conflicts are
reported without replacing local source. The host decides whether to reload,
merge, overwrite, or open a comparison UI.

`autoSaveDelay` is opt-in, bounded to 100–60000 milliseconds, and debounced.
Only one request runs at a time. A response marks the editor clean only when
the exact source and document revision sent are still current. Edits made
during a request therefore remain dirty and can schedule a later autosave.
Destruction cancels timers, aborts the owned request, and removes optional
leave-page protection.

Native textarea form submission remains independent of the adapter: the
hidden textarea is synchronized before submit. This supports progressive
enhancement where the normal form remains authoritative.

## Framework-neutral and Node transport

`createEditorSaveWorkflow({ editor, adapter })` works with Workspace, React,
Vue, modal editors, or dynamically inserted fields. A Node service can
implement the same adapter around its API client; the contract does not depend
on `fetch` or the DOM.

For React or Vue, create the workflow when the Workspace editor becomes ready,
retain it in a ref/shallow ref, and call `destroy()` from the same lifecycle
cleanup that owns the Workspace. Do not recreate it on every render. Multiple
editors each own a workflow; revision tokens and requests are never global.

```tsx
const result = useSoEditorWorkspace(workspaceOptions);
useEffect(() => {
    if (!result.workspace) return;
    const saving = createEditorSaveWorkflow({
        adapter,
        editor: result.workspace.editor,
    });
    return () => saving.destroy();
}, [result.workspace]);
```

```ts
const result = useSoEditorWorkspace(workspaceOptions);
watch(result.workspace, (workspace, _previous, onCleanup) => {
    if (!workspace) return;
    const saving = createEditorSaveWorkflow({
        adapter,
        editor: workspace.editor,
    });
    onCleanup(() => saving.destroy());
});
```

For modal and dynamic-field integrations, destroy the Classic handle before
removing its host. If dirty work needs confirmation, the application should
prompt before closing the modal; `beforeunload` protects only page navigation.
The same ownership rule supports dynamic form fields:

```ts
const editors = new Map<HTMLElement, ClassicEditor>();
async function addField(host: HTMLTextAreaElement) {
    editors.set(host, await createClassicEditor(host, { save: { adapter } }));
}
async function removeField(host: HTMLTextAreaElement) {
    await editors.get(host)?.destroy();
    editors.delete(host);
    host.remove();
}
```

## Security and backend responsibilities

The backend remains responsible for authentication, authorization, CSRF
protection, request limits, optimistic concurrency, durable storage, and
server-side sanitization for the eventual rendering context. A successful
client save is not proof that preserved HTML is safe to execute.
