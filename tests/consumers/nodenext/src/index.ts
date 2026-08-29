import { Editor, createServiceToken, type Transaction } from '@soeditor/core';
import {
    DiagnosticsPlugin as SdkDiagnosticsPlugin,
    Plugin,
    UiPlugin as SdkUiPlugin,
    diagnosticsServiceToken as sdkDiagnosticsServiceToken,
    uiRegistryServiceToken as sdkUiRegistryServiceToken,
    type DiagnosticProvider as SdkDiagnosticProvider,
    type StatusItemFactory,
} from '@soeditor/plugin-sdk';
import {
    classicPreset,
    developerPreset,
    extendPreset,
    markdownPreset,
    minimalPreset,
    type EditorPreset,
} from '@soeditor/presets';
import {
    createDeveloperToolsEngine,
    createDocumentOutline,
    DeveloperToolsPlugin,
    type DeveloperToolsEngineOptions,
    type InspectorElement,
    type OutlineItem,
} from '@soeditor/dev-tools';
import {
    FileManagerPlugin,
    fileManagerServiceToken,
    normalizeFileManagerResult,
    type FileManager,
    type FileManagerOpenOptions,
    type FileManagerResult,
} from '@soeditor/file-manager';
import {
    SoFinderAdapter,
    type SoFinderAdapterOptions,
    type SoFinderSelection,
} from '@soeditor/adapter-sofinder';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlElement,
} from '@soeditor/html';
import {
    DiagnosticsPlugin,
    HtmlFormattingPlugin,
    diagnosticsServiceToken,
    type DiagnosticProvider,
    type HtmlFormattingOptions,
    type Problem,
} from '@soeditor/html-tools';
import {
    createVisualEditingEngine,
    HistoryPlugin,
    type EditingSelection,
} from '@soeditor/engine';
import { BoldPlugin, type LinkOptions } from '@soeditor/rich-text';
import {
    createSourceEditingEngine,
    SourceEditingPlugin,
    sourceEditingServiceToken,
    type SourceEditingEngineOptions,
} from '@soeditor/source';
import {
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUiTheme,
    type KeyboardShortcutDefinition,
    type ToolbarConfiguration,
} from '@soeditor/ui';
import {
    createMarkdownEditingEngine,
    createMarkdownPreviewRenderer,
    htmlToMarkdown,
    markdownToHtml,
    MarkdownPlugin,
    type MarkdownEditingEngineOptions,
    type MarkdownRenderOptions,
} from '@soeditor/markdown';
import {
    createPreviewEngine,
    PreviewPlugin,
    previewServiceToken,
    type PreviewConfiguration,
    type PreviewEngineOptions,
} from '@soeditor/preview';
// @ts-expect-error Editing-model internals are not a package subpath API.
import type { EditingModel } from '@soeditor/engine/model';

interface ExampleService {
    readonly value: string;
}

const ExampleServiceToken = createServiceToken<ExampleService>('example');

class ConsumerPlugin extends Plugin {
    static readonly id = 'consumer';
    static readonly requires = [SdkUiPlugin, SdkDiagnosticsPlugin];
    #disposeDiagnostic: (() => void) | undefined;
    #disposeStatus: (() => void) | undefined;

    override init(): void {
        this.editor.commands.register({
            id: 'consumer.replace',
            execute: ({ editor }, source) => {
                editor.update(
                    (transaction: Transaction) => {
                        transaction.replaceDocument(String(source));
                    },
                    { origin: 'command' },
                );
            },
        });
        const statusFactory: StatusItemFactory = ({ document, editor }) => {
            const element = document.createElement('span');
            return {
                element,
                update: () => {
                    element.textContent = String(editor.getData().length);
                },
            };
        };
        this.#disposeStatus = this.editor.services
            .get(sdkUiRegistryServiceToken)
            .registerStatusItem('consumer.length', statusFactory);
        const provider: SdkDiagnosticProvider = {
            id: 'consumer.nonempty',
            provide: (source) =>
                source.length === 0
                    ? [
                          {
                              code: 'consumer.empty',
                              message: 'Document is empty.',
                              severity: 'warning',
                          },
                      ]
                    : [],
        };
        this.#disposeDiagnostic = this.editor.services
            .get(sdkDiagnosticsServiceToken)
            .register(provider);
    }

    override destroy(): void {
        this.#disposeDiagnostic?.();
        this.#disposeStatus?.();
    }
}

const editor = await Editor.create({
    config: { nested: { enabled: true } },
    data: '<p>NodeNext</p>',
    plugins: [
        ConsumerPlugin,
        HistoryPlugin,
        BoldPlugin,
        SourceEditingPlugin,
        DiagnosticsPlugin,
        HtmlFormattingPlugin,
        UiPlugin,
        PreviewPlugin,
    ],
});

editor.services.register(ExampleServiceToken, { value: 'available' });
editor.execute('consumer.replace', '<p>Compiled</p>');
const serviceValue: string = editor.services.get(ExampleServiceToken).value;

if (serviceValue.length === 0) {
    throw new Error('Typed service lookup returned an invalid value.');
}

const htmlResult = parseHtmlFragment(
    '<product-card data-id="123">Content</product-card>',
);
const firstHtmlNode = htmlResult.document.children[0];

if (firstHtmlNode?.type !== 'element') {
    throw new Error('Packed HTML package returned an unexpected tree.');
}

const htmlElement: HtmlElement = firstHtmlNode;
const serializedHtml: string = serializeHtmlFragment(htmlResult.document);
const visualFactory: typeof createVisualEditingEngine =
    createVisualEditingEngine;
const visualSelection: EditingSelection = {
    anchor: { block: 0, offset: 0 },
    focus: { block: 0, offset: 0 },
};

if (
    htmlElement.tagName !== 'product-card' ||
    !serializedHtml.includes('data-id="123"')
) {
    throw new Error('Packed HTML package failed semantic preservation.');
}

void visualFactory;
void visualSelection;
const linkOptions: LinkOptions = { href: '/relative' };
void linkOptions;
const sourceFactory: typeof createSourceEditingEngine =
    createSourceEditingEngine;
const sourceOptions = undefined as SourceEditingEngineOptions | undefined;
void sourceFactory;
void sourceOptions;
void sourceEditingServiceToken;
const diagnosticProvider: DiagnosticProvider = {
    id: 'consumer',
    provide: () => [],
};
const formattingOptions: HtmlFormattingOptions = { printWidth: 80 };
const problems: readonly Problem[] = [];
void diagnosticProvider;
void formattingOptions;
void problems;
void diagnosticsServiceToken;
const toolbar: ToolbarConfiguration = ['undo', '|', 'source'];
const theme: EditorUiTheme = 'auto';
const shortcut: KeyboardShortcutDefinition = {
    id: 'consumer.shortcut',
    chord: 'Alt+K',
    command: 'consumer.replace',
};
editor.services.get(uiRegistryServiceToken).registerShortcut(shortcut);
void toolbar;
void theme;
const previewFactory: typeof createPreviewEngine = createPreviewEngine;
const previewConfiguration: PreviewConfiguration = {
    template: '<main>{{ content }}</main>',
};
const previewOptions = undefined as PreviewEngineOptions | undefined;
void previewFactory;
void previewConfiguration;
void previewOptions;
void previewServiceToken;
const markdownFactory: typeof createMarkdownEditingEngine =
    createMarkdownEditingEngine;
const markdownOptions = undefined as MarkdownEditingEngineOptions | undefined;
const markdownRenderOptions: MarkdownRenderOptions = { rawHtml: 'preserve' };
const markdownRenderer = createMarkdownPreviewRenderer(markdownRenderOptions);
const markdownHtml: string = markdownToHtml('# Consumer');
const convertedMarkdown: string = htmlToMarkdown('<h1>Consumer</h1>').source;
void markdownFactory;
void markdownOptions;
void markdownRenderer;
void markdownHtml;
void convertedMarkdown;
void MarkdownPlugin;
const developerToolsFactory: typeof createDeveloperToolsEngine =
    createDeveloperToolsEngine;
const developerToolsOptions = undefined as
    DeveloperToolsEngineOptions | undefined;
const outline: readonly OutlineItem[] = createDocumentOutline('<h1>Title</h1>');
const inspector = undefined as InspectorElement | undefined;
void developerToolsFactory;
void developerToolsOptions;
void outline;
void inspector;
void DeveloperToolsPlugin;
const presets: readonly EditorPreset[] = [
    minimalPreset,
    classicPreset,
    developerPreset,
    markdownPreset,
];
const extendedPreset = extendPreset(minimalPreset, {
    plugins: [ConsumerPlugin],
});
void presets;
void extendedPreset;
const fileManager: FileManager = new SoFinderAdapter({
    pick: async (
        options: FileManagerOpenOptions,
    ): Promise<SoFinderSelection> => ({
        metadata: { kind: options.kind },
        mimeType: 'image/png',
        url: '/consumer.png',
    }),
});
const adapterOptions: SoFinderAdapterOptions = {
    pick: async () => ({ url: '/consumer.png' }),
};
const fileResult: FileManagerResult | null = normalizeFileManagerResult({
    url: '/consumer.png',
});
void fileManager;
void adapterOptions;
void fileResult;
void fileManagerServiceToken;
void FileManagerPlugin;
const rejectInternalModel = (value: EditingModel): void => {
    void value;
};
void rejectInternalModel;

// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.commands.clear();
// @ts-expect-error Plugin lifecycle is not a consumer capability.
editor.plugins.destroy();
// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.services.clear();
// @ts-expect-error Cleanup is owned by Editor.destroy().
editor.events.clear();
// @ts-expect-error Event publication is owned by core infrastructure.
editor.events.emit('editor:ready', { editor });

await editor.destroy();
