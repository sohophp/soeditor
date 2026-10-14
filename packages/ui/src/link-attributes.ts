import type { Editor } from '@soeditor/core';

export interface TagCustomAttributeValue {
    readonly name: string;
    readonly value: string;
}

export interface LinkTargetProvider {
    select(
        kind: 'file' | 'internal',
    ): PromiseLike<{ href: string; title?: string } | null>;
    searchInternal?(
        query: string,
    ): PromiseLike<readonly { href: string; title: string }[]>;
}

/** Prefer host page/file mapping; otherwise use FileManagerPlugin's selection-only command. */
export function resolveLinkTargetProvider(
    editor: Editor,
): LinkTargetProvider | undefined {
    const provider = editor.services.tryGet<LinkTargetProvider>(
        'soeditor.link-target-provider',
    );
    if (provider) return provider;
    if (!editor.commands.has('link.file.select')) return undefined;
    return {
        select: async (kind) => {
            if (kind !== 'file') return null;
            const value: unknown = await editor.execute('link.file.select');
            if (value === null || value === undefined) return null;
            if (
                typeof value !== 'object' ||
                !('href' in value) ||
                typeof value.href !== 'string'
            )
                throw new TypeError('File selection returned an invalid link.');
            return {
                href: value.href,
                ...('title' in value && typeof value.title === 'string'
                    ? { title: value.title }
                    : {}),
            };
        },
    };
}

export function attachLinkTargetControls(options: {
    document: Document;
    container: HTMLElement;
    fileButtonContainer: HTMLElement;
    href: HTMLInputElement;
    title?: HTMLInputElement;
    displayed?: HTMLInputElement;
    selectedText: string;
    provider: LinkTargetProvider | undefined;
    translate(message: string): string;
    report(error: unknown): void;
    fileIcon(element: HTMLElement): void;
}): () => void {
    if (options.provider === undefined) return () => {};
    let disposed = false;
    let inputPending = false;
    let cleanup: (() => void) | undefined;
    const captureInput = (): void => {
        inputPending = true;
    };
    options.href.addEventListener('input', captureInput, { once: true });
    void import('./link-target-controls.js')
        .then(({ attachLinkTargetControlsNow }) => {
            options.href.removeEventListener('input', captureInput);
            if (disposed) return;
            cleanup = attachLinkTargetControlsNow(options, inputPending);
        })
        .catch((error: unknown) => {
            options.href.removeEventListener('input', captureInput);
            if (!disposed) options.report(error);
        });
    return () => {
        disposed = true;
        options.href.removeEventListener('input', captureInput);
        cleanup?.();
    };
}

interface TagAttributeSuggestion {
    readonly name: string;
    readonly values?: readonly string[];
}

const blockedNames = new Set(['is', 'nonce', 'srcdoc', 'style', 'xmlns']);

export function readInspectedCustomAttributes(
    values: Record<string, unknown>,
): readonly TagCustomAttributeValue[] {
    if (!Array.isArray(values.customAttributes)) return [];
    return values.customAttributes.flatMap((entry: unknown) => {
        const name =
            typeof entry === 'object' && entry !== null
                ? Reflect.get(entry, 'name')
                : undefined;
        const value =
            typeof entry === 'object' && entry !== null
                ? Reflect.get(entry, 'value')
                : undefined;
        return typeof name === 'string' && typeof value === 'string'
            ? [{ name, value }]
            : [];
    });
}

export function linkCustomAttributeField(
    document: Document,
    container: HTMLElement,
    initial: readonly TagCustomAttributeValue[],
    suggestionsValue: unknown,
    translate: (message: string) => string,
): {
    readonly value: () => readonly TagCustomAttributeValue[] | undefined;
} {
    return tagCustomAttributeField(
        document,
        container,
        initial,
        suggestionsValue,
        translate,
        ['href', 'rel', 'target', 'title'],
    );
}

export function tagCustomAttributeField(
    document: Document,
    container: HTMLElement,
    initial: readonly TagCustomAttributeValue[],
    suggestionsValue: unknown,
    translate: (message: string) => string,
    managed: readonly string[],
): { readonly value: () => readonly TagCustomAttributeValue[] | undefined } {
    const suggestions: readonly TagAttributeSuggestion[] = Array.isArray(
        suggestionsValue,
    )
        ? suggestionsValue.flatMap((entry: unknown) => {
              if (typeof entry !== 'object' || entry === null) return [];
              const name = Reflect.get(entry, 'name');
              const values: unknown = Reflect.get(entry, 'values');
              return typeof name === 'string' &&
                  (values === undefined ||
                      (Array.isArray(values) &&
                          values.every(
                              (value): value is string =>
                                  typeof value === 'string',
                          )))
                  ? [{ name, ...(values === undefined ? {} : { values }) }]
                  : [];
          })
        : [];
    const supportedNames = new Set(suggestions.map(({ name }) => name));
    const managedNames = new Set(managed);
    const attributes = new Map(initial.map(({ name, value }) => [name, value]));
    const suffix = String(
        document.querySelectorAll('.soeditor-ui__link-attributes').length,
    );
    const prefix = `soeditor-link-attribute-${suffix}`;
    const section = document.createElement('section');
    section.className = 'soeditor-ui__link-attributes';
    // This is a closed, static UI template. User values are added below with
    // DOM text/value properties and never interpolated into markup.
    section.innerHTML = `
<div><strong>Additional attributes</strong><p>Add standard or CMS attributes. Reserved names are blocked.</p></div><div class=soeditor-ui__link-attribute-row><label class=soeditor-ui__field><span>Attribute name</span><input data-role=name aria-label="Attribute name" list="${prefix}-names" maxlength=64 autocomplete=off placeholder="Choose or enter an attribute name"></label><label class=soeditor-ui__field><span>Attribute value</span><input data-role=value aria-label="Attribute value" maxlength=4096 autocomplete=off></label><button data-role=add type=button class=soeditor-ui__dialog-action>Add attribute</button></div><div class=soeditor-ui__link-rel-custom><label class=soeditor-ui__field><span>Added attributes</span><select data-role=list></select></label><button data-role=remove type=button class="soeditor-ui__dialog-action is-danger">Remove attribute</button></div><p data-role=empty class=soeditor-ui__link-attributes-empty>No additional attributes.</p><datalist id="${prefix}-names"></datalist><datalist id="${prefix}-values"></datalist>`;
    const name = required<HTMLInputElement>(section, '[data-role="name"]');
    const value = required<HTMLInputElement>(section, '[data-role="value"]');
    const add = required<HTMLButtonElement>(section, '[data-role="add"]');
    const list = required<HTMLSelectElement>(section, '[data-role="list"]');
    const listControls = required<HTMLElement>(
        section,
        '.soeditor-ui__link-rel-custom',
    );
    const remove = required<HTMLButtonElement>(section, '[data-role="remove"]');
    const empty = required<HTMLElement>(section, '[data-role="empty"]');
    const nameSuggestions = required<HTMLDataListElement>(
        section,
        `#${prefix}-names`,
    );
    const valueSuggestions = required<HTMLDataListElement>(
        section,
        `#${prefix}-values`,
    );
    for (const suggestion of suggestions) {
        const option = document.createElement('option');
        option.value = suggestion.name;
        nameSuggestions.append(option);
    }
    name.spellcheck = false;
    container.append(section);

    const render = (): void => {
        list.replaceChildren(
            ...Array.from(attributes, ([attributeName, attributeValue]) => {
                const option = document.createElement('option');
                option.value = attributeName;
                option.textContent = `${attributeName} = ${attributeValue || '""'}`;
                return option;
            }),
        );
        empty.hidden = attributes.size > 0;
        listControls.hidden = attributes.size === 0;
    };
    const updateValueSuggestions = (): void => {
        const values = suggestions.find(
            ({ name: candidate }) => candidate === name.value.trim(),
        )?.values;
        valueSuggestions.replaceChildren(
            ...(values ?? []).map((candidate) => {
                const option = document.createElement('option');
                option.value = candidate;
                return option;
            }),
        );
        if (values === undefined) value.removeAttribute('list');
        else value.setAttribute('list', valueSuggestions.id);
    };
    const commit = (): boolean => {
        const attributeName = name.value.trim().toLowerCase();
        const supported =
            supportedNames.has(attributeName) ||
            /^data-[a-z0-9_.:-]+$/u.test(attributeName);
        const invalid =
            !/^[a-z][a-z0-9_.:-]{0,63}$/u.test(attributeName) ||
            managedNames.has(attributeName) ||
            blockedNames.has(attributeName) ||
            attributeName.startsWith('on') ||
            attributeName.startsWith('data-soeditor-') ||
            !supported ||
            (attributes.size >= 32 && !attributes.has(attributeName));
        name.setCustomValidity(invalid ? translate('Invalid attribute.') : '');
        if (!name.reportValidity()) return false;
        const listedValues = suggestions.find(
            ({ name: candidate }) => candidate === attributeName,
        )?.values;
        value.setCustomValidity(
            listedValues !== undefined && !listedValues.includes(value.value)
                ? translate('Invalid attribute.')
                : '',
        );
        if (!value.reportValidity()) return false;
        attributes.set(attributeName, value.value);
        name.value = value.value = '';
        updateValueSuggestions();
        render();
        return true;
    };
    name.addEventListener('input', () => {
        name.setCustomValidity('');
        updateValueSuggestions();
    });
    value.addEventListener('input', () => value.setCustomValidity(''));
    name.addEventListener('change', () => {
        name.value = name.value.trim().toLowerCase();
        updateValueSuggestions();
    });
    add.addEventListener('click', commit);
    list.addEventListener('click', () => {
        name.value = list.value;
        value.value = attributes.get(list.value) ?? '';
        updateValueSuggestions();
    });
    remove.addEventListener('click', () => {
        attributes.delete(list.value);
        name.value = value.value = '';
        updateValueSuggestions();
        render();
    });
    render();

    return {
        value: () => {
            if (name.value.length > 0 && !commit()) return undefined;
            return Object.freeze(
                Array.from(attributes, ([name, value]) => ({ name, value })),
            );
        },
    };
}

function required<T extends Element>(root: Element, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (element === null) throw new Error('Link attribute UI is incomplete.');
    return element;
}
