import type { Editor } from '@soeditor/core';
import { visualEditingServiceToken } from '@soeditor/engine';

import { sourceEditingServiceToken } from './source-editing-service.js';
import { sourceRangeForEditingSelection } from './source-mapping.js';

const sourceStyles = `.soeditor-classic__source{box-sizing:border-box;min-height:12rem;min-width:0;overflow:auto}.soeditor-classic__surfaces[data-orientation=horizontal]{grid-template-columns:minmax(0,calc(var(--soeditor-classic-pane-ratio) - .3125rem)) .625rem minmax(0,calc(var(--soeditor-classic-pane-inverse-ratio) - .3125rem))}.soeditor-classic__surfaces[data-orientation=vertical]{grid-template-rows:minmax(0,calc(var(--soeditor-classic-pane-ratio) - .3125rem)) .625rem minmax(0,calc(var(--soeditor-classic-pane-inverse-ratio) - .3125rem))}.soeditor-classic__surfaces[data-orientation]>.soeditor-classic__visual,.soeditor-classic__surfaces[data-orientation]>.soeditor-classic__source{contain:paint;height:auto!important;isolation:isolate;max-height:none!important;min-height:0}.soeditor-classic__pane-resize-handle{background:var(--soeditor-border,#d0d7de);min-height:0;min-width:0;touch-action:none}.soeditor-classic__surfaces[data-orientation=horizontal]>.soeditor-classic__pane-resize-handle{cursor:col-resize}.soeditor-classic__surfaces[data-orientation=vertical]>.soeditor-classic__pane-resize-handle{cursor:row-resize}.soeditor-classic__pane-resize-handle:focus-visible{box-shadow:inset 0 0 0 3px var(--soeditor-focus-ring,#0969da);outline:0}.soeditor-classic__workspace-picker{align-items:center;display:inline-flex;margin-inline-start:.25rem}.soeditor-classic__workspace-picker .soeditor-ui__button{border-radius:0;min-width:var(--soeditor-control-size,2.25rem)}.soeditor-classic__workspace-picker .soeditor-ui__button:first-child{border-end-start-radius:var(--soeditor-radius,.375rem);border-start-start-radius:var(--soeditor-radius,.375rem)}.soeditor-classic__workspace-picker .soeditor-ui__button:last-child{border-end-end-radius:var(--soeditor-radius,.375rem);border-start-end-radius:var(--soeditor-radius,.375rem)}.soeditor-classic__workspace-picker .soeditor-ui__button+.soeditor-ui__button{margin-inline-start:-1px}.soeditor-classic__workspace-picker .soeditor-ui__button.is-active{background:var(--soeditor-accent-soft,#eeecff);color:var(--soeditor-accent,#655ce7);position:relative;z-index:1}.soeditor-classic__source>.cm-editor{height:100%;min-height:0}.soeditor-classic__source .cm-scroller{overflow:auto}.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar .soeditor-ui__separator,.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar [data-toolbar-item]{display:none}.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar [data-toolbar-item=source],.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar [data-toolbar-item=sourceFind],.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar [data-toolbar-item=format],.soeditor-classic[data-soeditor-mode=source] .soeditor-ui__toolbar [data-toolbar-item=minify]{display:inline-flex}`;
const attachedStyles = new WeakMap<
    Document,
    { count: number; element: HTMLStyleElement }
>();

export interface ClassicSourceEnhancementOptions {
    readonly document: Document;
    readonly editor: Editor;
    readonly format?: (source: string) => Promise<string>;
    readonly formatDelay?: number;
    readonly isSelectionSyncActive: () => boolean;
    readonly isDestroyed: () => boolean;
    readonly reportError: (error: unknown) => void;
    readonly visual: HTMLElement;
    readonly visualShadow: ShadowRoot;
}

/** Attaches Source-only formatting and passive WYSIWYG selection mirroring. */
export function attachClassicSourceEnhancements(
    options: ClassicSourceEnhancementOptions,
): () => void {
    const disposeStyles = attachSourceStyles(options.document);
    let frame: number | undefined;
    let timer: number | undefined;
    let generation = 0;
    const view = options.document.defaultView;
    const synchronizeSelection = (): void => {
        frame = undefined;
        if (options.isDestroyed() || !options.isSelectionSyncActive()) return;
        const selection = options.editor.services
            .tryGet(visualEditingServiceToken)
            ?.getSelection();
        if (selection === undefined) return;
        const range = sourceRangeForEditingSelection(
            options.editor.getData(),
            selection,
            options.document,
        );
        if (range === undefined) return;
        options.editor.services
            .get(sourceEditingServiceToken)
            .reveal(range, { focus: false });
    };
    const scheduleSelectionSync = (): void => {
        if (view === null || frame !== undefined) return;
        frame = view.requestAnimationFrame(synchronizeSelection);
    };
    options.visualShadow.addEventListener(
        'selectionchange',
        scheduleSelectionSync,
    );
    options.visual.addEventListener('keyup', scheduleSelectionSync);
    options.visual.addEventListener('pointerup', scheduleSelectionSync);
    const disposeDocumentChange = options.editor.events.on(
        'document:change',
        ({ current, transaction }) => {
            if (transaction.origin !== 'source') scheduleSelectionSync();
            if (
                options.format === undefined ||
                transaction.origin !== 'user' ||
                !options.isSelectionSyncActive()
            ) {
                return;
            }
            generation += 1;
            const currentGeneration = generation;
            if (timer !== undefined) view?.clearTimeout(timer);
            timer = view?.setTimeout(() => {
                timer = undefined;
                const source = current.source;
                void options
                    .format?.(source)
                    .then((formatted) => {
                        if (
                            options.isDestroyed() ||
                            !options.isSelectionSyncActive() ||
                            generation !== currentGeneration ||
                            options.editor.getData() !== source ||
                            formatted === source
                        ) {
                            return;
                        }
                        options.editor.update(
                            (next) => next.replaceDocument(formatted),
                            { origin: 'plugin' },
                        );
                    })
                    .catch((error: unknown) => {
                        if (
                            !options.isDestroyed() &&
                            generation === currentGeneration
                        ) {
                            options.reportError(error);
                        }
                    });
            }, options.formatDelay ?? 300);
        },
    );
    return () => {
        generation += 1;
        disposeDocumentChange();
        options.visualShadow.removeEventListener(
            'selectionchange',
            scheduleSelectionSync,
        );
        options.visual.removeEventListener('keyup', scheduleSelectionSync);
        options.visual.removeEventListener('pointerup', scheduleSelectionSync);
        if (timer !== undefined) view?.clearTimeout(timer);
        if (frame !== undefined) view?.cancelAnimationFrame(frame);
        timer = undefined;
        frame = undefined;
        disposeStyles();
    };
}

function attachSourceStyles(document: Document): () => void {
    const current = attachedStyles.get(document);
    if (current !== undefined) {
        current.count += 1;
        return () => releaseSourceStyles(document);
    }
    const element = document.createElement('style');
    element.dataset.soeditorClassicSourceStyles = 'true';
    element.textContent = sourceStyles;
    document.head.append(element);
    attachedStyles.set(document, { count: 1, element });
    return () => releaseSourceStyles(document);
}

function releaseSourceStyles(document: Document): void {
    const current = attachedStyles.get(document);
    if (current === undefined) return;
    current.count -= 1;
    if (current.count > 0) return;
    current.element.remove();
    attachedStyles.delete(document);
}
