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
    /** Catch up only when a visual edit occurred during asynchronous loading. */
    readonly formatOnAttach?: boolean;
    readonly isSelectionSyncActive: () => boolean;
    readonly isScrollSyncActive: () => boolean;
    readonly isDestroyed: () => boolean;
    readonly reportError: (error: unknown) => void;
    readonly scrollSync?: boolean;
    readonly source: HTMLElement;
    readonly visual: HTMLElement;
    readonly visualScroller: HTMLElement;
    readonly visualShadow: ShadowRoot;
}

/** Attaches Source-only formatting and passive WYSIWYG selection mirroring. */
export function attachClassicSourceEnhancements(
    options: ClassicSourceEnhancementOptions,
): () => void {
    const disposeStyles = attachSourceStyles(options.document);
    let frame: number | undefined;
    let scrollFrame: number | undefined;
    let scrollOrigin: HTMLElement | undefined;
    let ignoredScrollTarget: HTMLElement | undefined;
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
    const sourceScroller =
        options.source.querySelector<HTMLElement>('.cm-scroller');
    const synchronizeScroll = (): void => {
        scrollFrame = undefined;
        const origin = scrollOrigin;
        scrollOrigin = undefined;
        if (
            origin === undefined ||
            sourceScroller === null ||
            options.isDestroyed() ||
            !options.isScrollSyncActive()
        ) {
            return;
        }
        const target =
            origin === options.visualScroller
                ? sourceScroller
                : options.visualScroller;
        const originRange = origin.scrollHeight - origin.clientHeight;
        const targetRange = target.scrollHeight - target.clientHeight;
        if (originRange <= 0 || targetRange <= 0) return;
        const next = (origin.scrollTop / originRange) * targetRange;
        if (Math.abs(target.scrollTop - next) < 1) return;
        ignoredScrollTarget = target;
        target.scrollTop = next;
        view?.requestAnimationFrame(() => {
            if (ignoredScrollTarget === target) ignoredScrollTarget = undefined;
        });
    };
    const scheduleScrollSync = (event: Event): void => {
        const origin = event.currentTarget;
        if (!(origin instanceof HTMLElement)) return;
        if (ignoredScrollTarget === origin) {
            ignoredScrollTarget = undefined;
            return;
        }
        if (
            options.scrollSync !== true ||
            view === null ||
            !options.isScrollSyncActive()
        ) {
            return;
        }
        scrollOrigin = origin;
        if (scrollFrame === undefined) {
            scrollFrame = view.requestAnimationFrame(synchronizeScroll);
        }
    };
    options.visualShadow.addEventListener(
        'selectionchange',
        scheduleSelectionSync,
    );
    options.visual.addEventListener('keyup', scheduleSelectionSync);
    options.visual.addEventListener('pointerup', scheduleSelectionSync);
    options.visualScroller.addEventListener('scroll', scheduleScrollSync, {
        passive: true,
    });
    sourceScroller?.addEventListener('scroll', scheduleScrollSync, {
        passive: true,
    });
    const scheduleFormatting = (source: string): void => {
        generation += 1;
        const currentGeneration = generation;
        if (timer !== undefined) view?.clearTimeout(timer);
        timer = view?.setTimeout(() => {
            timer = undefined;
            if (
                options.isDestroyed() ||
                !options.isSelectionSyncActive() ||
                options.editor.state.readonly
            )
                return;
            void options
                .format?.(source)
                .then((formatted) => {
                    if (
                        options.isDestroyed() ||
                        options.editor.state.readonly ||
                        !options.isSelectionSyncActive() ||
                        generation !== currentGeneration ||
                        options.editor.getData() !== source ||
                        formatted === source
                    )
                        return;
                    options.editor.update(
                        (next) => next.replaceDocument(formatted),
                        { origin: 'plugin' },
                    );
                })
                .catch((error: unknown) => {
                    if (
                        !options.isDestroyed() &&
                        generation === currentGeneration
                    )
                        options.reportError(error);
                });
        }, options.formatDelay ?? 300);
    };
    const disposeDocumentChange = options.editor.events.on(
        'document:change',
        ({ current, transaction }) => {
            if (transaction.origin !== 'source') scheduleSelectionSync();
            if (
                options.format !== undefined &&
                transaction.origin === 'user' &&
                options.isSelectionSyncActive()
            )
                scheduleFormatting(current.source);
        },
    );
    // Catch up with the current caret as well as edits made during lazy loading.
    scheduleSelectionSync();
    if (options.format !== undefined && options.formatOnAttach === true)
        scheduleFormatting(options.editor.getData());
    return () => {
        generation += 1;
        disposeDocumentChange();
        options.visualShadow.removeEventListener(
            'selectionchange',
            scheduleSelectionSync,
        );
        options.visual.removeEventListener('keyup', scheduleSelectionSync);
        options.visual.removeEventListener('pointerup', scheduleSelectionSync);
        options.visualScroller.removeEventListener(
            'scroll',
            scheduleScrollSync,
        );
        sourceScroller?.removeEventListener('scroll', scheduleScrollSync);
        if (timer !== undefined) view?.clearTimeout(timer);
        if (frame !== undefined) view?.cancelAnimationFrame(frame);
        if (scrollFrame !== undefined) view?.cancelAnimationFrame(scrollFrame);
        timer = undefined;
        frame = undefined;
        scrollFrame = undefined;
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
