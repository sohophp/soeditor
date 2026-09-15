import './classic-editor-disclosure.css';

export interface ClassicEditorDisclosureLabels {
    readonly collapse: string;
    readonly edit: string;
    readonly empty: string;
    readonly hasContent: string;
}

export interface CreateClassicEditorDisclosureOptions {
    /** Nodes moved into the disclosure body in their current order. */
    readonly content: readonly HTMLElement[];
    /** Textarea hosts used to derive the current content state. */
    readonly editors: readonly HTMLTextAreaElement[];
    /** Overrides content-state detection, for example for one active language. */
    readonly hasContent?: () => boolean;
    readonly expanded?: boolean;
    readonly labels: ClassicEditorDisclosureLabels;
}

export interface ClassicEditorDisclosure {
    readonly element: HTMLDetailsElement;
    readonly summary: HTMLElement;
    destroy(): void;
    expand(): void;
    refresh(): void;
}

const disclosures = new WeakMap<HTMLElement, ClassicEditorDisclosure>();

/**
 * Adds a lightweight, native disclosure around one CMS body field.
 * Use one container per language/editor for independent expansion. Passing
 * multiple hosts explicitly groups them under one control for compatibility.
 *
 * This entry has no editor-runtime imports. A host can register the contained
 * textarea normally and defer editor creation until the disclosure is opened.
 */
export function createClassicEditorDisclosure(
    container: HTMLElement,
    options: CreateClassicEditorDisclosureOptions,
): ClassicEditorDisclosure {
    const existing = disclosures.get(container);
    if (existing !== undefined) return existing;
    if (options.content.length === 0)
        throw new TypeError('Editor disclosure requires content nodes.');
    if (options.editors.length === 0)
        throw new TypeError('Editor disclosure requires textarea hosts.');
    if (
        options.content.some((node) => node.parentElement !== container) ||
        options.editors.some((editor) => !container.contains(editor))
    ) {
        throw new TypeError(
            'Editor disclosure nodes must belong to the container.',
        );
    }

    const document = container.ownerDocument;
    const element = document.createElement('details');
    element.className = 'soeditor-disclosure';
    element.open = options.expanded ?? false;
    const summary = document.createElement('summary');
    summary.className = 'soeditor-disclosure__summary';
    element.append(summary, ...options.content);
    container.append(element);

    let destroyed = false;
    const refresh = (): void => {
        if (destroyed) return;
        const present =
            options.hasContent?.() ??
            options.editors.some((editor) => editor.value.trim() !== '');
        summary.textContent = `${element.open ? options.labels.collapse : options.labels.edit} · ${present ? options.labels.hasContent : options.labels.empty}`;
        element.dataset.contentState = present ? 'present' : 'empty';
    };
    const onToggle = (): void => {
        refresh();
        element.dispatchEvent(
            new CustomEvent('soeditor:disclosure-change', {
                bubbles: true,
                detail: { expanded: element.open },
            }),
        );
    };
    element.addEventListener('toggle', onToggle);
    element.addEventListener('input', refresh);
    element.addEventListener('change', refresh);

    const api: ClassicEditorDisclosure = {
        element,
        summary,
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            element.removeEventListener('toggle', onToggle);
            element.removeEventListener('input', refresh);
            element.removeEventListener('change', refresh);
            // Preserve nodes mounted asynchronously alongside the textarea too.
            summary.remove();
            element.replaceWith(...Array.from(element.childNodes));
            disclosures.delete(container);
        },
        expand: () => {
            if (!destroyed) element.open = true;
        },
        refresh,
    };
    disclosures.set(container, api);
    refresh();
    return api;
}
