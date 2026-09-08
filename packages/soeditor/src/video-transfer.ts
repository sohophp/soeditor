import { SOEDITOR_CLIPBOARD_MIME } from '@soeditor/engine';
import { serializeHtmlFragment } from '@soeditor/html';
import type { AtomicTransferContext } from '@soeditor/wysiwyg';

/** Canonical clipboard and drag protection belongs to the optional projection. */
export function transferVideo(context: AtomicTransferContext): void {
    const { event, element, range } = context;
    const atoms = Array.from(
        element.querySelectorAll('[data-soeditor-atomic]'),
    ).filter((node) => context.isAtomic(node) && range.intersectsNode(node));
    if (atoms.length === 0) return;
    if (event.type === 'dragstart') {
        event.preventDefault();
        return;
    }
    if (!('clipboardData' in event) || event.clipboardData === null) return;
    event.preventDefault();
    const fragment = range.cloneContents();
    for (const atom of atoms) {
        const clone = fragment.querySelector(
            `[data-soeditor-atomic="${atom.getAttribute('data-soeditor-atomic') ?? ''}"]`,
        );
        if (clone !== null) context.copySource(atom, clone);
    }
    const children = Array.from(fragment.childNodes).flatMap((node) => {
        const converted = context.serialize(node);
        return converted === undefined ? [] : [converted];
    });
    const html = serializeHtmlFragment({ type: 'document-fragment', children });
    event.clipboardData.setData('text/html', html);
    event.clipboardData.setData(SOEDITOR_CLIPBOARD_MIME, `soeditor/1\n${html}`);
    for (const clone of Array.from(
        fragment.querySelectorAll('[data-soeditor-atomic]'),
    ))
        clone.textContent = '';
    event.clipboardData.setData('text/plain', fragment.textContent ?? '');
    if (event.type === 'cut') context.cut();
}
