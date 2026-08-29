import { SoFinderAdapter } from '@soeditor/adapter-sofinder';
import { Editor, Plugin } from '@soeditor/core';
import {
    createDeveloperToolsEngine,
    developerToolsServiceToken,
} from '@soeditor/dev-tools';
import { createVisualEditingEngine } from '@soeditor/engine';
import {
    fileManagerServiceToken,
    type FileManager,
} from '@soeditor/file-manager';
import {
    AccessibilityDiagnosticsPlugin,
    diagnosticsServiceToken,
    SeoDiagnosticsPlugin,
} from '@soeditor/html-tools';
import {
    createSplitViewLayout,
    SplitViewPlugin,
    splitViewServiceToken,
    type SplitViewPair,
} from '@soeditor/layout';
import {
    createMarkdownEditingEngine,
    createMarkdownPreviewRenderer,
    markdownEditingServiceToken,
} from '@soeditor/markdown';
import {
    classicPreset,
    developerPreset,
    markdownPreset,
    minimalPreset,
} from '@soeditor/presets';
import { createPreviewEngine, previewServiceToken } from '@soeditor/preview';
import {
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
} from '@soeditor/projections';
import { createSourceEditingEngine } from '@soeditor/source';
import { createEditorUi, UiPlugin, uiRegistryServiceToken } from '@soeditor/ui';
import '@soeditor/ui/styles.css';

class DemoPlugin extends Plugin {
    static readonly id = 'demo';
    static readonly requires = [UiPlugin];
    #disposeFailingToolbarItem: (() => void) | undefined;
    #disposeFailingStatusItem: (() => void) | undefined;
    #disposeToolbarItem: (() => void) | undefined;
    #disposeShortcut: (() => void) | undefined;
    #disposeStatusItem: (() => void) | undefined;

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
        this.#disposeStatusItem = registry.registerStatusItem(
            'demo.word-count',
            ({ document, editor }) => {
                const element = document.createElement('span');
                element.setAttribute('aria-label', 'Document word count');
                return {
                    element,
                    update: () => {
                        const text = editor
                            .getData()
                            .replace(/<[^>]*>/gu, ' ')
                            .trim();
                        const count =
                            text.length === 0 ? 0 : text.split(/\s+/u).length;
                        element.textContent = `Words ${String(count)}`;
                    },
                };
            },
        );
        if (parameters.get('status') === 'failing-cleanup') {
            this.#disposeFailingStatusItem = registry.registerStatusItem(
                'demo.failing-cleanup',
                ({ document }) => ({
                    element: document.createElement('span'),
                    destroy: () => {
                        throw new Error('Example status cleanup failed.');
                    },
                }),
            );
        }
    }

    override destroy(): void {
        this.#disposeFailingToolbarItem?.();
        this.#disposeFailingStatusItem?.();
        this.#disposeShortcut?.();
        this.#disposeStatusItem?.();
        this.#disposeToolbarItem?.();
        this.#disposeFailingToolbarItem = undefined;
        this.#disposeFailingStatusItem = undefined;
        this.#disposeShortcut = undefined;
        this.#disposeStatusItem = undefined;
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
const splitViewHost = document.querySelector<HTMLElement>('#split-view');
const uiHost = document.querySelector<HTMLElement>('#editor-ui');

if (
    stateOutput === null ||
    sourceOutput === null ||
    editingHost === null ||
    sourceEditingHost === null ||
    markdownEditingHost === null ||
    previewHost === null ||
    splitViewHost === null ||
    uiHost === null
) {
    throw new Error('Playground output or editing host was not found.');
}

const parameters = new URLSearchParams(window.location.search);
const markdownDocument = parameters.get('format') === 'markdown';
const splitPair = readSplitPair(parameters.get('split'));
const persistentProjections =
    parameters.get('projections') === 'persistent' || splitPair !== undefined;
const cmsExample = parameters.get('example') === 'cms';
const developerDocument = parameters.get('preset') !== 'classic';
const htmlPreset = developerDocument ? developerPreset : classicPreset;
const htmlPlugins = [
    DemoPlugin,
    ...(persistentProjections ? [ProjectionCoordinatorPlugin] : []),
    ...(splitPair === undefined ? [] : [SplitViewPlugin]),
    ...htmlPreset.plugins,
    ...(developerDocument
        ? [AccessibilityDiagnosticsPlugin, SeoDiagnosticsPlugin]
        : []),
];
document.body.dataset.demo = markdownDocument
    ? 'markdown'
    : cmsExample
      ? 'cms-sofinder'
      : developerDocument
        ? 'developer'
        : 'classic';
const editor = await Editor.create(
    markdownDocument
        ? {
              data: '# SoEditor Markdown\n\n- canonical source\n- isolated preview\n\n<product-card data-id="123"></product-card>',
              format: 'markdown',
              plugins: [
                  DemoPlugin,
                  ...(persistentProjections
                      ? [ProjectionCoordinatorPlugin]
                      : []),
                  ...(splitPair === undefined ? [] : [SplitViewPlugin]),
                  ...markdownPreset.plugins,
              ],
              readonly: parameters.has('readonly'),
          }
        : {
              data: cmsExample
                  ? '<!--CMS:block:42--><h1>CMS article</h1><p>Edit me safely.</p><product-card data-id="123"></product-card><!--CMS:end:42-->'
                  : '<p>Hello <strong>SoEditor</strong></p><product-card data-id="123"></product-card><!--CMS:block-->',
              plugins: htmlPlugins,
              readonly: parameters.has('readonly'),
              ...(developerDocument
                  ? {
                        config: {
                            htmlTools: {
                                diagnostics: {
                                    validation: {
                                        mode: 'debounced' as const,
                                        delay: 250,
                                    },
                                },
                            },
                        },
                    }
                  : {}),
          },
);
if (!markdownDocument && developerDocument) {
    editor.services.get(diagnosticsServiceToken).register({
        id: 'playground.cms-markers',
        provide: (source) =>
            source.includes('<product-card')
                ? [
                      {
                          code: 'playground.custom-element',
                          message:
                              'Custom product-card content is preserved for the CMS.',
                          severity: 'hint',
                      },
                  ]
                : [],
    });
}
if (!markdownDocument) {
    const customManager: FileManager = {
        open: async () => ({
            alt: 'Custom manager image',
            name: 'custom-manager-image.png',
            url: '/custom-manager-image.png',
        }),
    };
    const manager =
        parameters.get('files') === 'sofinder' || cmsExample
            ? new SoFinderAdapter({
                  pick: async () => ({
                      height: 480,
                      mimeType: 'image/png',
                      name: 'sofinder-image.png',
                      url: '/sofinder-image.png',
                      width: 640,
                  }),
              })
            : customManager;
    editor.services.register(fileManagerServiceToken, manager);
}
const visualEngine = markdownDocument
    ? undefined
    : createVisualEditingEngine({
          activateOnFocus: persistentProjections,
          editor,
          element: editingHost,
      });
const sourceEngine = markdownDocument
    ? undefined
    : createSourceEditingEngine({
          activateOnFocus: persistentProjections,
          editor,
          element: sourceEditingHost,
      });
const markdownEngine = markdownDocument
    ? createMarkdownEditingEngine({
          activateOnFocus: persistentProjections,
          editor,
          element: markdownEditingHost,
      })
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
const splitView =
    splitPair === undefined
        ? undefined
        : createSplitViewLayout({
              editor,
              element: splitViewHost,
              hosts: {
                  markdown: markdownEditingHost,
                  preview: previewHost,
                  source: sourceEditingHost,
                  visual: editingHost,
              },
              initialPair: splitPair,
          });
if (splitView !== undefined) {
    document
        .querySelectorAll<HTMLElement>('[data-surface-heading]')
        .forEach((heading) => {
            heading.hidden = true;
        });
}
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
                    toolbar: htmlPreset.toolbar,
                }),
});
const developerToolsEngine =
    markdownDocument || !developerDocument
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
    createSplitViewLayout,
    createSourceEditingEngine,
    createVisualEditingEngine,
    editor,
    developerToolsEngine,
    developerToolsServiceToken,
    diagnosticsServiceToken,
    fileManagerServiceToken,
    markdownEditingServiceToken,
    markdownEngine,
    minimalPreset,
    selectedDemo: document.body.dataset.demo,
    previewEngine,
    previewServiceToken,
    projectionCoordinatorServiceToken,
    sourceEngine,
    splitView,
    splitViewServiceToken,
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

function readSplitPair(value: string | null): SplitViewPair | undefined {
    if (value === null) return undefined;
    if (
        value === 'visual-source' ||
        value === 'source-preview' ||
        value === 'markdown-preview'
    ) {
        return value;
    }
    throw new TypeError(`Unknown Playground split pair "${value}".`);
}
