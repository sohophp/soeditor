import type {
    EditorUi,
    ToolbarItemContext,
    ToolbarItemFactory,
    ToolbarItemInstance,
} from './types.js';

const pendingRoots = new WeakMap<EditorUi, HTMLElement>();

/** Reuse the mounted control so toolbar semantics, focus and selectors stay stable. */
export function mountToolbarTool(
    context: ToolbarItemContext,
    root: HTMLElement,
    factory: ToolbarItemFactory,
): ToolbarItemInstance {
    pendingRoots.set(context.ui, root);
    try {
        root.replaceChildren();
        return factory(context);
    } finally {
        pendingRoots.delete(context.ui);
    }
}

export function createToolbarRoot<K extends keyof HTMLElementTagNameMap>(
    document: Document,
    ui: EditorUi,
    tag: K,
): HTMLElementTagNameMap[K] {
    const root = pendingRoots.get(ui);
    if (root?.localName === tag) {
        pendingRoots.delete(ui);
        return root as HTMLElementTagNameMap[K];
    }
    return document.createElement(tag);
}
