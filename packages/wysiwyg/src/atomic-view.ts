import { createServiceToken } from '@soeditor/core';
import type { HtmlChildNode, HtmlElement } from '@soeditor/html';

/** A projection must never modify its canonical node or execute embedded HTML. */
export interface AtomicViewContext {
    readonly document: Document;
    readonly node: HtmlElement;
    select(): boolean;
    isSelected(): boolean;
    replace(node: HtmlElement): boolean;
    insertParagraph(position: 'before' | 'after'): void;
}

/** An instance-owned inert rendering of one complete HTML element. */
export interface AtomicView {
    readonly element: HTMLElement;
    readonly type: string;
}

/** Controlled clipboard bridge. Copy source metadata only to detached clones. */
export interface AtomicTransferContext {
    readonly event: ClipboardEvent | DragEvent;
    readonly element: HTMLElement;
    readonly range: Range;
    isAtomic(element: Element): boolean;
    copySource(source: Element, clone: Element): void;
    serialize(node: Node): HtmlChildNode | undefined;
    cut(): void;
}

/** Optional projection hook, registered before the WYSIWYG engine is mounted. */
export interface AtomicViewService {
    create(context: AtomicViewContext): AtomicView | undefined;
    transfer(context: AtomicTransferContext): void;
    selected(origin: Element, range?: Range): AtomicView | undefined;
}

export const atomicViewServiceToken = createServiceToken<AtomicViewService>(
    'soeditor.wysiwyg.atomic-view',
);
