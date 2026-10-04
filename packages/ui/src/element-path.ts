import type { EditorUiElementPathEntry } from './types.js';

/** Frame-coalesced, instance-owned element breadcrumb projection. */
export function createElementPath(
    document: Document,
    read: () => readonly string[] | readonly EditorUiElementPathEntry[],
    actions?: {
        select(id: string): void;
        unwrap(): void;
        translate(text: string): string;
    },
) {
    const element = document.createElement('span');
    element.className = 'soeditor-ui__element-path';
    element.dataset.soeditorNoTranslate = 'true';
    element.hidden = true;
    let frame: number | undefined;
    let destroyed = false;
    let previous = '';
    const view = document.defaultView;
    const render = (): void => {
        frame = undefined;
        if (destroyed) return;
        const items = read();
        const text = JSON.stringify(items);
        if (text === previous) return;
        previous = text;
        if (items.every((item) => typeof item === 'string')) {
            element.textContent = items.join(' › ');
            element.hidden = items.length === 0;
            return;
        }
        const active = document.activeElement;
        const focusedId =
            active instanceof HTMLElement && element.contains(active)
                ? active.dataset.elementTarget
                : undefined;
        const content = document.createDocumentFragment();
        element.hidden = items.length === 0;
        for (const [index, item] of items.entries()) {
            if (index > 0) content.append(document.createTextNode(' › '));
            if (typeof item === 'string' || !actions) {
                content.append(
                    document.createTextNode(
                        typeof item === 'string' ? item : item.tagName,
                    ),
                );
                continue;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = item.tagName;
            button.dataset.elementTarget = item.id;
            button.setAttribute('aria-pressed', String(item.selected));
            button.addEventListener('click', () => actions.select(item.id));
            content.append(button);
        }
        const selected = items.find(
            (item): item is EditorUiElementPathEntry =>
                typeof item !== 'string' && item.selected,
        );
        if (selected && actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.elementAction = 'unwrap';
            button.textContent = actions.translate('Remove outer tag');
            button.disabled = !selected.canUnwrap;
            if (selected.unavailableReason)
                button.title = actions.translate(selected.unavailableReason);
            button.addEventListener('click', actions.unwrap);
            content.append(button);
        }
        element.replaceChildren(content);
        if (focusedId) {
            for (const button of Array.from(
                element.querySelectorAll<HTMLButtonElement>(
                    'button[data-element-target]',
                ),
            )) {
                if (button.dataset.elementTarget === focusedId)
                    button.focus({ preventScroll: true });
            }
        }
    };
    return {
        element,
        update(): void {
            if (destroyed || frame !== undefined) return;
            if (view === null) render();
            else frame = view.requestAnimationFrame(render);
        },
        destroy(): void {
            destroyed = true;
            if (frame !== undefined) view?.cancelAnimationFrame(frame);
            frame = undefined;
            element.remove();
        },
    };
}

/** Walk only the selected content ancestry; never include the surface wrapper. */
export function elementPathForRange(
    range: Range | undefined,
): readonly string[] {
    if (range === undefined) return [];
    let node = range.commonAncestorContainer;
    if (!node.isConnected) return [];
    // A selected image/object has its parent as the range container.
    if (
        !range.collapsed &&
        range.startContainer === range.endContainer &&
        range.endOffset === range.startOffset + 1
    ) {
        node = range.startContainer.childNodes[range.startOffset] ?? node;
    }
    let element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    const parts: string[] = [];
    while (element !== null) {
        if (element.classList.contains('soeditor-wysiwyg-content')) {
            return element.hasAttribute('hidden') ? [] : parts.reverse();
        }
        // Editing affordances are not canonical content.
        if (element.classList.contains('soeditor-image-resize-overlay'))
            return [];
        parts.push(
            element.getAttribute('data-soeditor-element') ?? element.localName,
        );
        element = element.parentElement;
    }
    return [];
}
