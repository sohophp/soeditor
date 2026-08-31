import {
    Editor,
    EditorDestroyedError,
    EditorInitializationAbortedError,
    Plugin,
} from '@soeditor/core';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';
import { createVisualEditingEngine, HistoryPlugin } from '@soeditor/engine';
import { BoldPlugin } from '@soeditor/rich-text';
import { SourceEditingPlugin } from '@soeditor/source';
import { DiagnosticsPlugin, HtmlFormattingPlugin } from '@soeditor/html-tools';
import { UiPlugin, uiRegistryServiceToken } from '@soeditor/ui';
import { PreviewPlugin } from '@soeditor/preview';
import { SplitViewPlugin, splitViewServiceToken } from '@soeditor/layout';
import {
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
} from '@soeditor/projections';
import {
    createMarkdownPreviewRenderer,
    markdownToHtml,
    MarkdownPlugin,
} from '@soeditor/markdown';
import {
    createDocumentOutline,
    DeveloperToolsPlugin,
} from '@soeditor/dev-tools';
import {
    commentsServiceToken,
    createCommentsPlugin,
    createRevisionsPlugin,
    pastePipelineServiceToken as sdkPastePipelineServiceToken,
    Plugin as SdkPlugin,
    revisionsServiceToken,
    SplitViewPlugin as SdkSplitViewPlugin,
    UiPlugin as SdkUiPlugin,
    splitViewServiceToken as sdkSplitViewServiceToken,
    uiRegistryServiceToken as sdkUiRegistryServiceToken,
    uploadServiceToken as sdkUploadServiceToken,
} from '@soeditor/plugin-sdk';
import {
    developerPreset,
    extendPreset,
    minimalPreset,
} from '@soeditor/presets';
import { minimalPreset as subpathMinimalPreset } from '@soeditor/presets/minimal';
import {
    SoEditor,
    minimalPreset as umbrellaMinimalPreset,
} from '@soeditor/editor';
import { SoFinderAdapter } from '@soeditor/adapter-sofinder';
import { normalizeFileManagerResult } from '@soeditor/file-manager';
import { createEditorWorkspace } from '@soeditor/workspace';
import { useSoEditorWorkspace as useReactSoEditorWorkspace } from '@soeditor/react';
import { useSoEditorWorkspace as useVueSoEditorWorkspace } from '@soeditor/vue';
import { pluginTemplateVersion } from '@soeditor/plugin-tools';

if (
    typeof useReactSoEditorWorkspace !== 'function' ||
    typeof useVueSoEditorWorkspace !== 'function' ||
    pluginTemplateVersion !== 3
) {
    throw new Error('Packed 1.0 adapter or plugin-tool import failed.');
}
if (
    sdkPastePipelineServiceToken.id !== 'soeditor.paste-pipeline' ||
    sdkUploadServiceToken.id !== 'soeditor.upload'
) {
    throw new Error('Packed CMS plugin SDK tokens are unavailable.');
}
const integrationWorkspace = await createEditorWorkspace({
    createEditor: ({ source }) => Editor.create({ data: source }),
    value: { initialValue: '<p>Workspace runtime</p>', kind: 'uncontrolled' },
});
if (integrationWorkspace.editor.getData() !== '<p>Workspace runtime</p>') {
    throw new Error('Packed Workspace runtime contract failed.');
}
await integrationWorkspace.destroy();

class DestroyDuringInit extends Plugin {
    static id = 'destroy-during-init';

    init() {
        void this.editor.destroy();
    }
}

class RuntimeSdkPlugin extends SdkPlugin {
    static id = 'runtime-sdk';
    static requires = [SdkUiPlugin];

    init() {
        this.editor.services
            .get(sdkUiRegistryServiceToken)
            .registerStatusItem('runtime-sdk.length', ({ document }) => ({
                element: document.createElement('span'),
            }));
    }
}

let reviewThreads = [
    {
        createdAt: 1,
        id: 'thread-1',
        messages: [
            {
                author: { id: 'reviewer', name: 'Reviewer' },
                body: 'Review this',
                createdAt: 1,
                id: 'message-1',
            },
        ],
        range: {
            from: { block: 0, offset: 0 },
            to: { block: 0, offset: 6 },
        },
        state: 'linked',
        updatedAt: 1,
    },
];
const reviewRevisions = [
    {
        author: { id: 'author', name: 'Author' },
        createdAt: 1,
        format: 'html',
        id: 'revision-1',
        kind: 'saved',
        label: 'Initial',
        source: '<p>Review</p>',
    },
];
const reviewEditor = await Editor.create({
    data: '<p>Review</p>',
    plugins: [
        createCommentsPlugin({
            author: () => ({ id: 'reviewer', name: 'Reviewer' }),
            createId: () => 'unused',
            permissions: { can: () => true },
            storage: {
                load: async () => reviewThreads,
                save: async (threads) => {
                    reviewThreads = threads;
                },
            },
        }),
        createRevisionsPlugin({
            author: () => ({ id: 'reviewer', name: 'Reviewer' }),
            permissions: { can: () => true },
            provider: {
                list: async () => reviewRevisions,
                load: async (id) =>
                    reviewRevisions.find((revision) => revision.id === id),
            },
            storage: {
                erase: async (id) => {
                    const index = reviewRevisions.findIndex(
                        (revision) => revision.id === id,
                    );
                    if (index >= 0) reviewRevisions.splice(index, 1);
                },
                list: async () => reviewRevisions,
                load: async (id) =>
                    reviewRevisions.find((revision) => revision.id === id),
                save: async () => {
                    throw new Error('Unexpected review save.');
                },
            },
        }),
    ],
});
const packedComments = reviewEditor.services.get(commentsServiceToken);
const packedRevisions = reviewEditor.services.get(revisionsServiceToken);
if (
    packedComments.exportData().threads.length !== 1 ||
    (await packedRevisions.exportData()).revisions.length !== 1
) {
    throw new Error('Packed review data export contract failed.');
}
await packedComments.delete('thread-1');
await packedComments.erase('thread-1');
await packedRevisions.erase('revision-1');
if (
    reviewThreads.length !== 0 ||
    reviewRevisions.length !== 0 ||
    packedRevisions.snapshot.revisions.length !== 0
) {
    throw new Error('Packed review data erasure contract failed.');
}
await reviewEditor.destroy();

const extendedRuntimePreset = extendPreset(minimalPreset, {
    plugins: [RuntimeSdkPlugin],
});
const umbrellaEditor = await SoEditor.create({
    data: '<p>Umbrella runtime</p>',
    plugins: umbrellaMinimalPreset.plugins,
});
if (umbrellaEditor.getData() !== '<p>Umbrella runtime</p>') {
    throw new Error(
        'Packed @soeditor/editor umbrella returned unexpected data.',
    );
}
await umbrellaEditor.destroy();
const projectionEditor = await Editor.create({
    plugins: [ProjectionCoordinatorPlugin],
});
const projectionService = projectionEditor.services.get(
    projectionCoordinatorServiceToken,
);
projectionService.attach({ id: 'visual', update: () => undefined });
if (projectionService.snapshot.primary !== 'visual') {
    throw new Error('Packed projection coordinator returned invalid state.');
}
await projectionEditor.destroy();
const sdkLayoutEditor = await Editor.create({ plugins: [SdkSplitViewPlugin] });
const sdkLayoutProjections = sdkLayoutEditor.services.get(
    projectionCoordinatorServiceToken,
);
sdkLayoutProjections.attach({ id: 'visual', update: () => undefined });
sdkLayoutProjections.attach({ id: 'source', update: () => undefined });
let sdkLayoutPair;
sdkLayoutEditor.services.get(sdkSplitViewServiceToken).attach({
    focus: () => undefined,
    supports: () => true,
    update: (snapshot) => {
        sdkLayoutPair = snapshot.pair;
    },
});
sdkLayoutEditor.execute('layout.split.open', 'visual-source');
if (sdkLayoutPair !== 'visual-source') {
    throw new Error('Packed SDK split-view runtime contract failed.');
}
await sdkLayoutEditor.destroy();
const layoutEditor = await Editor.create({ plugins: [SplitViewPlugin] });
if (
    !layoutEditor.commands.has('layout.split.open') ||
    layoutEditor.services.get(splitViewServiceToken).attached
) {
    throw new Error('Packed split-view command contract failed.');
}
await layoutEditor.destroy();
if (
    extendedRuntimePreset.plugins.at(-1) !== RuntimeSdkPlugin ||
    subpathMinimalPreset !== minimalPreset ||
    !developerPreset.plugins.some((plugin) => plugin.id === 'developer-tools')
) {
    throw new Error(
        'Packed plugin SDK or presets failed its runtime smoke test.',
    );
}

try {
    await Editor.create({ plugins: [DestroyDuringInit] });
    throw new Error('Destroyed startup unexpectedly returned an editor.');
} catch (error) {
    if (!(error instanceof EditorInitializationAbortedError)) {
        throw error;
    }
}

const editor = await Editor.create({
    data: '<p>Runtime</p>',
    plugins: [
        HistoryPlugin,
        BoldPlugin,
        SourceEditingPlugin,
        DiagnosticsPlugin,
        HtmlFormattingPlugin,
        UiPlugin,
        PreviewPlugin,
        DeveloperToolsPlugin,
    ],
});

if (editor.getData() !== '<p>Runtime</p>') {
    throw new Error('Packed editor returned unexpected document data.');
}

if (!editor.commands.has('format.bold')) {
    throw new Error('Packed rich-text plugin did not register its command.');
}

if (!editor.commands.has('editor.source')) {
    throw new Error('Packed source plugin did not register its command.');
}

if (
    !editor.commands.has('document.validate') ||
    !editor.commands.has('document.format')
) {
    throw new Error('Packed HTML tools did not register their commands.');
}

const selectedAsset = await new SoFinderAdapter({
    pick: async () => ({
        mimeType: 'image/png',
        url: '/runtime.png',
    }),
}).open({ kind: 'image', multiple: false });
if (
    selectedAsset?.mime !== 'image/png' ||
    normalizeFileManagerResult(selectedAsset)?.url !== '/runtime.png'
) {
    throw new Error(
        'Packed file-manager adapter failed its runtime smoke test.',
    );
}

if (editor.services.tryGet(uiRegistryServiceToken) === undefined) {
    throw new Error('Packed UI plugin did not register its service.');
}

if (!import.meta.resolve('@soeditor/ui/styles.css').endsWith('/styles.css')) {
    throw new Error('Packed UI stylesheet export could not be resolved.');
}

if (!editor.commands.has('editor.preview')) {
    throw new Error('Packed preview plugin did not register its command.');
}

if (
    !editor.commands.has('developer.find') ||
    createDocumentOutline('<h2>Runtime outline</h2>')[0]?.label !==
        'Runtime outline'
) {
    throw new Error(
        'Packed developer-tools package failed its runtime smoke test.',
    );
}

const markdownEditor = await Editor.create({
    data: '# Runtime',
    format: 'markdown',
    plugins: [MarkdownPlugin],
});
if (
    markdownEditor.state.mode !== 'markdown' ||
    !markdownToHtml(markdownEditor.getData()).includes('<h1>Runtime</h1>') ||
    !createMarkdownPreviewRenderer().supports('markdown')
) {
    throw new Error('Packed Markdown package failed its Node ESM smoke test.');
}
await markdownEditor.destroy();

editor.setData('<p>Changed</p>');
editor.execute('editor.undo');
if (editor.getData() !== '<p>Runtime</p>') {
    throw new Error('Packed history plugin failed undo.');
}

await editor.destroy();

const html = parseHtmlFragment(
    '<!--marker--><product-card data-id="123">Runtime</product-card>',
);
const serialized = serializeHtmlFragment(html.document);

if (typeof createVisualEditingEngine !== 'function') {
    throw new Error('Packed visual engine module could not load in Node ESM.');
}

if (
    !serialized.includes('<!--marker-->') ||
    !serialized.includes('<product-card data-id="123">Runtime</product-card>')
) {
    throw new Error('Packed HTML runtime failed semantic preservation.');
}

try {
    editor.commands.has('missing');
    throw new Error('Destroyed packed editor remained operational.');
} catch (error) {
    if (!(error instanceof EditorDestroyedError)) {
        throw error;
    }
}
