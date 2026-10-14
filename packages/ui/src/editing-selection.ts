import type { EditorUi } from './types.js';

const ranges = new WeakMap<EditorUi, () => Range | undefined>();

export function registerEditingRange(
    ui: EditorUi,
    read: () => Range | undefined,
): void {
    ranges.set(ui, read);
}

export function hasImageSelection(ui: EditorUi): boolean {
    const range = ranges.get(ui)?.();
    if (
        range === undefined ||
        range.collapsed ||
        !range.startContainer.isConnected
    )
        return false;
    const contents = range.cloneContents();
    return (
        contents.querySelectorAll('img').length === 1 &&
        (contents.textContent ?? '').trim() === ''
    );
}
