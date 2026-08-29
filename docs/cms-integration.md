# CMS and SoFinder integration

The Playground route `/?example=cms&files=sofinder` is an executable reference:
it preserves CMS comments and a custom `<product-card>`, inserts an image through
the generic FileManager command, and previews the resulting canonical HTML.

A host integration follows the same boundaries:

```ts
import {
    SoEditor,
    SoFinderAdapter,
    createEditorUi,
    createSourceEditingEngine,
    createVisualEditingEngine,
    developerPreset,
    fileManagerServiceToken,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: await cms.loadEntrySource(entryId),
    format: developerPreset.format,
    plugins: developerPreset.plugins,
    config: { cms: { entryId } },
});

editor.services.register(
    fileManagerServiceToken,
    new SoFinderAdapter({
        // This bridge belongs to the host and its concrete SoFinder version.
        pick: async (request) => {
            const asset = await cmsSoFinderDialog.pick(request);
            return asset === null
                ? null
                : {
                      alt: asset.alt,
                      height: asset.height,
                      mimeType: asset.mime,
                      name: asset.name,
                      url: asset.url,
                      width: asset.width,
                  };
        },
    }),
);

const visual = createVisualEditingEngine({ editor, element: visualHost });
const source = createSourceEditingEngine({ editor, element: sourceHost });
const ui = createEditorUi({
    editor,
    element: uiHost,
    toolbar: developerPreset.toolbar,
});

saveButton.addEventListener('click', async () => {
    await cms.saveEntrySource(entryId, editor.getData());
    editor.markClean();
});
```

`SoFinderAdapter` has no SoFinder runtime dependency. The CMS owns loading,
authentication, permissions, dialog security, and mapping its asset object to
the narrow selection value. Cancellation returns `null`; unsafe or malformed
results are rejected before the shared `image.insert` command mutates content.

Never read the visual DOM as saved content. Persist `editor.getData()` so custom
elements, meaningful attributes, and CMS comments remain in the canonical
source according to SoEditor's semantic-preservation policy.

## 0.9 Workspace composition

For a recoverable CMS field, move the same explicit resources into Workspace
factories. Register host services in `createEditor`, declare attachment
requirements, and keep durable saving outside Workspace:

```ts
const workspace = await createEditorWorkspace({
    createEditor: async ({ source }) => {
        const editor = await SoEditor.create({
            data: source,
            format: developerPreset.format,
            plugins: developerPreset.plugins,
        });
        editor.services.register(fileManagerServiceToken, fileManager);
        return editor;
    },
    attachments: [
        {
            id: 'visual',
            requirements: {
                formats: ['html'],
                services: [
                    { label: 'FileManager', token: fileManagerServiceToken },
                ],
            },
            attach: ({ editor }) =>
                createVisualEditingEngine({ editor, element: visualHost }),
        },
    ],
    recovery: { maxRestarts: 3, windowMs: 60_000 },
    value: {
        initialValue: await cms.loadEntrySource(entryId),
        kind: 'uncontrolled',
        onChange: ({ source }) => cms.saveDraft(entryId, source),
    },
});
```

Recovery preserves the last canonical source in memory; it does not replace
the CMS draft store, authentication, authorization, conflict handling, or
durable revision history.
