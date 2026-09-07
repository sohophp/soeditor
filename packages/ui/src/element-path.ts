/** Read-only, instance-owned element breadcrumb projection. */
export function createElementPath(
    document: Document,
    read: () => readonly string[],
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
        const text = read().join(' › ');
        if (text === previous) return;
        previous = text;
        element.textContent = text;
        element.hidden = text.length === 0;
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
        parts.push(element.localName);
        element = element.parentElement;
    }
    return [];
}
