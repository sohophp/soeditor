# CMS and SoFinder integration

> Current direction (2026-09-05): production integrations should use the narrow
> Classic CMS entry. The Developer Visual example below is a retained historical
> integration example, not the recommended default. Current WYSIWYG uses
> `@soeditor/editor/cms`; Source currently requires
> `@soeditor/editor/cms/optional`. Source loads on its first activation,
> with formatting and Preview loaded separately when used. See [configuration](configuration.md) and the
> [WYSIWYG + Source plan](wysiwyg-source-plan.zh-CN.md).

## Current Classic entry

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';
import '@soeditor/editor/cms/styles.css';

const textarea = document.querySelector<HTMLTextAreaElement>('#content');
if (textarea === null) throw new Error('Missing #content textarea.');
const classic = await createClassicEditor(textarea, {
    editingModes: ['wysiwyg', 'source'],
});
await classic.setWorkspaceView('source');
```

Register the public file-manager/upload services when the host enables those
integrations; see the [SoFinder adapter](../packages/adapter-sofinder/README.md)
for picker and upload contracts. Source mode is independent of the picker.

## Retained modular integration example

The Playground route `/?example=cms&files=sofinder` is an executable reference:
it preserves CMS comments and a custom `<product-card>`, inserts an image through
the generic FileManager command, and previews the resulting canonical HTML.

A host integration follows the same boundaries:

```ts
import {
    SoEditor,
    SoFinderAdapter,
    SoFinderUploadAdapter,
    createEditorUi,
    createSourceEditingEngine,
    createVisualEditingEngine,
    developerPreset,
    fileManagerServiceToken,
    uploadServiceToken,
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
editor.services.register(
    uploadServiceToken,
    new SoFinderUploadAdapter({
        // The host maps its public SoFinder SDK task to this narrow contract.
        upload: (request) => cmsSoFinderUploads.start(request),
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

The SoFinder adapters have no SoFinder runtime dependency. The CMS owns loading,
authentication, permissions, dialog security, and mapping its asset object to
the narrow selection/upload task values. Picker cancellation returns `null`;
uploads retain progress and cancellation. Unsafe or malformed results are
rejected before the shared `image.insert` command mutates content.
Optional `assetId`, `srcset`, and `sizes` values are validated and persisted as
neutral image attributes. The host, rather than SoFinder or SoEditor, owns the
responsive `sizes` rule because it depends on the CMS layout.

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
