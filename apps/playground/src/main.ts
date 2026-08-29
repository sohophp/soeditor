import { Editor, Plugin } from '@soeditor/core';
import {
    createDeveloperToolsEngine,
    DeveloperToolsPlugin,
    developerToolsServiceToken,
} from '@soeditor/dev-tools';
import { createVisualEditingEngine, HistoryPlugin } from '@soeditor/engine';
import { DiagnosticsPlugin, HtmlFormattingPlugin } from '@soeditor/html-tools';
import {
    createMarkdownEditingEngine,
    createMarkdownPreviewRenderer,
    MarkdownPlugin,
    markdownEditingServiceToken,
} from '@soeditor/markdown';
import {
    createPreviewEngine,
    PreviewPlugin,
    previewServiceToken,
} from '@soeditor/preview';
import {
    BlockquotePlugin,
    BoldPlugin,
    CodeBlockPlugin,
    HeadingPlugin,
    ImagePlugin,
    InlineCodePlugin,
    ItalicPlugin,
    LinkPlugin,
    OrderedListPlugin,
    ParagraphPlugin,
    StrikePlugin,
    TablePlugin,
    UnderlinePlugin,
    UnorderedListPlugin,
} from '@soeditor/rich-text';
import {
    createSourceEditingEngine,
    SourceEditingPlugin,
} from '@soeditor/source';
import {
    createEditorUi,
    defaultToolbarConfiguration,
    UiPlugin,
    uiRegistryServiceToken,
} from '@soeditor/ui';
import '@soeditor/ui/styles.css';

class DemoPlugin extends Plugin {
    static readonly id = 'demo';
    static readonly requires = [UiPlugin];
    #disposeFailingToolbarItem: (() => void) | undefined;
    #disposeToolbarItem: (() => void) | undefined;
    #disposeShortcut: (() => void) | undefined;

    override init(): void {
        this.editor.commands.register({
            id: 'demo.uppercase',
            execute: ({ editor }) => {
                editor.update(
                    (transaction) => {
                        transaction.replaceDocument(
                            editor.getData().toUpperCase(),
                        );
                    },
                    { origin: 'command' },
                );
            },
        });
        const registry = this.editor.services.get(uiRegistryServiceToken);
        this.#disposeToolbarItem = registry.registerToolbarItem(
            'uppercase',
            ({ document, editor }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = 'Uppercase';
                button.addEventListener('click', () =>
                    editor.execute('demo.uppercase'),
                );
                return { element: button };
            },
        );
        this.#disposeFailingToolbarItem = registry.registerToolbarItem(
            'failing-update',
            ({ document }) => {
                const element = document.createElement('button');
                element.textContent = 'Failing update';
                return {
                    element,
                    update: () => {
                        throw new Error('Example toolbar update failed.');
                    },
                };
            },
        );
        this.#disposeShortcut = registry.registerShortcut({
            id: 'demo.uppercase',
            chord: 'Alt+U',
            command: 'demo.uppercase',
        });
    }

    override destroy(): void {
        this.#disposeFailingToolbarItem?.();
        this.#disposeShortcut?.();
        this.#disposeToolbarItem?.();
        this.#disposeFailingToolbarItem = undefined;
        this.#disposeShortcut = undefined;
        this.#disposeToolbarItem = undefined;
    }
}

const stateOutput = document.querySelector<HTMLElement>('#state');
const sourceOutput = document.querySelector<HTMLElement>('#source');
const editingHost = document.querySelector<HTMLElement>('#editor');
const sourceEditingHost = document.querySelector<HTMLElement>('#source-editor');
const markdownEditingHost =
    document.querySelector<HTMLElement>('#markdown-editor');
const previewHost = document.querySelector<HTMLElement>('#preview');
const uiHost = document.querySelector<HTMLElement>('#editor-ui');

if (
    stateOutput === null ||
    sourceOutput === null ||
    editingHost === null ||
    sourceEditingHost === null ||
    markdownEditingHost === null ||
    previewHost === null ||
    uiHost === null
) {
    throw new Error('Playground output or editing host was not found.');
}

const parameters = new URLSearchParams(window.location.search);
const markdownDocument = parameters.get('format') === 'markdown';
const htmlPlugins = [
    DemoPlugin,
    HistoryPlugin,
    ParagraphPlugin,
    HeadingPlugin,
    BoldPlugin,
    ItalicPlugin,
    UnderlinePlugin,
    StrikePlugin,
    LinkPlugin,
    OrderedListPlugin,
    UnorderedListPlugin,
    BlockquotePlugin,
    InlineCodePlugin,
    CodeBlockPlugin,
    ImagePlugin,
    TablePlugin,
    SourceEditingPlugin,
    DiagnosticsPlugin,
    HtmlFormattingPlugin,
    DeveloperToolsPlugin,
    PreviewPlugin,
];
const editor = await Editor.create(
    markdownDocument
        ? {
              data: '# SoEditor Markdown\n\n- canonical source\n- isolated preview\n\n<product-card data-id="123"></product-card>',
              format: 'markdown',
              plugins: [
                  DemoPlugin,
                  HistoryPlugin,
                  MarkdownPlugin,
                  PreviewPlugin,
              ],
              readonly: parameters.has('readonly'),
          }
        : {
              data: '<p>Hello <strong>SoEditor</strong></p><product-card data-id="123"></product-card><!--CMS:block-->',
              plugins: htmlPlugins,
              readonly: parameters.has('readonly'),
          },
);
const visualEngine = markdownDocument
    ? undefined
    : createVisualEditingEngine({ editor, element: editingHost });
const sourceEngine = markdownDocument
    ? undefined
    : createSourceEditingEngine({ editor, element: sourceEditingHost });
const markdownEngine = markdownDocument
    ? createMarkdownEditingEngine({ editor, element: markdownEditingHost })
    : undefined;
editingHost.hidden = markdownDocument;
sourceEditingHost.hidden = markdownDocument;
markdownEditingHost.hidden = !markdownDocument;
const previewEngine = createPreviewEngine({
    configuration: {
        baseUrl: 'https://example.test/content/',
        context: { section: 'Article' },
        styles: [
            'body { font-family: system-ui, sans-serif; margin: 2rem; } article { max-width: 48rem; margin: auto; }',
        ],
        stylesheets: ['data:text/css,product-card%7Bdisplay%3Ablock%7D'],
        template:
            '<!doctype html><html><head><title>SoEditor Preview</title></head><body><article data-section="{{ section }}">{{ content }}</article></body></html>',
        title: 'SoEditor content preview',
    },
    editor,
    element: previewHost,
    renderer: createMarkdownPreviewRenderer(),
});
const toolbarParameter = parameters.get('toolbar');
const ui = createEditorUi({
    editor,
    element: uiHost,
    ...(markdownDocument
        ? { toolbar: ['undo', 'redo', '|', 'markdown', 'preview'] }
        : toolbarParameter === 'compact'
          ? { toolbar: ['undo', '|', 'uppercase'] }
          : toolbarParameter === 'failing'
            ? { toolbar: ['failing-update'] }
            : toolbarParameter === 'missing'
              ? { toolbar: ['missing'] }
              : {
                    toolbar: [
                        ...defaultToolbarConfiguration,
                        '|',
                        'problems',
                        'inspector',
                        'outline',
                        'find-replace',
                        'command-palette',
                    ],
                }),
});
const developerToolsEngine = markdownDocument
    ? undefined
    : createDeveloperToolsEngine({
          editor,
          ui,
          visualElement: editingHost,
      });
(window as Window & { __soeditor?: unknown }).__soeditor = Object.freeze({
    Editor,
    createEditorUi,
    createDeveloperToolsEngine,
    createMarkdownEditingEngine,
    createPreviewEngine,
    createSourceEditingEngine,
    createVisualEditingEngine,
    editor,
    developerToolsEngine,
    developerToolsServiceToken,
    markdownEditingServiceToken,
    markdownEngine,
    previewEngine,
    previewServiceToken,
    sourceEngine,
    ui,
    visualEngine,
});

const render = (): void => {
    stateOutput.textContent = JSON.stringify(editor.state, null, 4);
    sourceOutput.textContent = editor.getData();
};

const bind = (id: string, callback: () => void): void => {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);

    if (button === null) {
        throw new Error(`Playground button "${id}" was not found.`);
    }

    button.addEventListener('click', callback);
};

editor.events.on('state:change', render);
bind('hello', () => editor.setData('<p>Hello</p>'));
bind('world', () => editor.setData('<p>World</p>'));
bind('mode', () => {
    editor.execute(
        editor.state.mode === 'source' ? 'editor.visual' : 'editor.source',
    );
});
bind('clean', () => editor.markClean());
bind('uppercase', () => {
    editor.execute('demo.uppercase');
});
bind('unsafe', () => {
    editor.setData(
        '<p>Safe text</p><img src="invalid:" onerror="window.__soeditorExecuted = true"><script>window.__soeditorExecuted = true</script>',
    );
});
bind('document', () => {
    editor.setData(
        '<!doctype html><html><head><title>Document</title></head><body><p>Preserved</p></body></html>',
    );
});
bind('inline-opaque', () => {
    editor.setData('<p>A<product-card data-id="1"></product-card>B</p>');
});
bind('destroy-engine', () => visualEngine?.destroy());
bind('destroy-editor', () => {
    void editor.destroy();
});
render();
