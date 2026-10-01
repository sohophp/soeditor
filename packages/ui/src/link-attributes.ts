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

let nextSuggestionId = 0;

/** Optional link target controls, loaded with the Link dialog rather than editor startup. */
export function attachLinkTargetControls(options: {
    document: Document;
    container: HTMLElement;
    fileButtonContainer: HTMLElement;
    href: HTMLInputElement;
    title: HTMLInputElement;
    displayed: HTMLInputElement;
    selectedText: string;
    provider: LinkTargetProvider | undefined;
    translate(message: string): string;
    report(error: unknown): void;
    fileIcon(element: HTMLElement): void;
}): () => void {
    const {
        document,
        container,
        fileButtonContainer,
        href,
        title,
        displayed,
        selectedText,
        translate,
        report,
        fileIcon,
    } = options;
    const provider = options.provider;
    let searchVersion = 0;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    let activeIndex = -1;
    let composing = false;
    const suggestions = document.createElement('div');
    suggestions.className = 'soeditor-ui__link-suggestions';
    suggestions.id = `soeditor-link-suggestions-${++nextSuggestionId}`;
    suggestions.setAttribute('role', 'listbox');
    suggestions.setAttribute('aria-label', translate('Choose internal link'));
    suggestions.hidden = true;
    const clearSuggestions = (): void => {
        searchVersion++;
        if (searchTimer !== undefined) clearTimeout(searchTimer);
        suggestions.replaceChildren();
        suggestions.hidden = true;
        activeIndex = -1;
        href.setAttribute('aria-expanded', 'false');
        href.removeAttribute('aria-activedescendant');
    };
    const activateSuggestion = (index: number): void => {
        const entries = suggestions.querySelectorAll<HTMLButtonElement>(
            '.soeditor-ui__link-suggestion:not(:disabled)',
        );
        if (entries.length === 0) return;
        activeIndex = (index + entries.length) % entries.length;
        entries.forEach((entry, entryIndex) => {
            const selected = entryIndex === activeIndex;
            entry.classList.toggle('is-active', selected);
            entry.setAttribute('aria-selected', String(selected));
        });
        const active = entries.item(activeIndex);
        if (active === null) return;
        href.setAttribute('aria-activedescendant', active.id);
        // Scroll only the list; scrolling ancestors can move the URL input.
        const listBounds = suggestions.getBoundingClientRect();
        const activeBounds = active.getBoundingClientRect();
        if (activeBounds.top < listBounds.top)
            suggestions.scrollTop -= listBounds.top - activeBounds.top;
        else if (activeBounds.bottom > listBounds.bottom)
            suggestions.scrollTop += activeBounds.bottom - listBounds.bottom;
    };

    if (typeof provider?.searchInternal === 'function') {
        container.classList.add('soeditor-ui__link-url-field--suggestions');
        href.placeholder = translate(
            'Enter / to search site pages or paste a URL',
        );
        href.setAttribute('role', 'combobox');
        href.setAttribute('aria-autocomplete', 'list');
        href.setAttribute('aria-controls', suggestions.id);
        href.setAttribute('aria-expanded', 'false');
        const search = (): void => {
            const query = href.value.trim();
            if (composing || !query.startsWith('/') || query.startsWith('//')) {
                clearSuggestions();
                return;
            }
            // Keep the current list visible while the next query is pending.
            // Hiding it on every keystroke makes the dropdown flash repeatedly.
            const version = ++searchVersion;
            if (searchTimer !== undefined) clearTimeout(searchTimer);
            activeIndex = -1;
            href.removeAttribute('aria-activedescendant');
            suggestions
                .querySelectorAll<HTMLButtonElement>(
                    '.soeditor-ui__link-suggestion',
                )
                .forEach((entry) => {
                    entry.disabled = true;
                    entry.classList.remove('is-active');
                    entry.setAttribute('aria-selected', 'false');
                });
            searchTimer = setTimeout(() => {
                void Promise.resolve()
                    .then(() => provider.searchInternal!(query))
                    .then((targets) => {
                        if (version !== searchVersion || !href.isConnected)
                            return;
                        suggestions.replaceChildren();
                        suggestions.scrollTop = 0;
                        for (const item of targets.slice(0, 20)) {
                            if (
                                !item.href.startsWith('/') ||
                                item.href.startsWith('//')
                            )
                                continue;
                            const option = document.createElement('button');
                            option.type = 'button';
                            option.className = 'soeditor-ui__link-suggestion';
                            option.setAttribute('role', 'option');
                            option.setAttribute('aria-selected', 'false');
                            option.id = `${suggestions.id}-${suggestions.childElementCount}`;
                            option.tabIndex = -1;
                            const label = document.createElement('span');
                            label.className =
                                'soeditor-ui__link-suggestion-title';
                            label.textContent = item.title;
                            const url = document.createElement('span');
                            url.className = 'soeditor-ui__link-suggestion-url';
                            url.textContent = item.href;
                            option.append(label, url);
                            option.addEventListener('pointerdown', (event) => {
                                event.preventDefault();
                            });
                            option.addEventListener('click', () => {
                                href.value = item.href;
                                title.value = item.title;
                                if (!selectedText && !displayed.value)
                                    displayed.value = item.title;
                                clearSuggestions();
                                href.focus();
                            });
                            suggestions.append(option);
                        }
                        suggestions.hidden =
                            suggestions.childElementCount === 0;
                        href.setAttribute(
                            'aria-expanded',
                            String(!suggestions.hidden),
                        );
                    })
                    .catch((error: unknown) => {
                        if (version === searchVersion) report(error);
                    });
            }, 200);
        };
        href.addEventListener('input', search);
        href.addEventListener('compositionstart', () => {
            composing = true;
            clearSuggestions();
        });
        href.addEventListener('compositionend', () => {
            composing = false;
            search();
        });
        href.addEventListener('keydown', (event) => {
            if (composing || event.isComposing) return;
            if (suggestions.hidden) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                activateSuggestion(
                    activeIndex < 0
                        ? event.key === 'ArrowDown'
                            ? 0
                            : -1
                        : activeIndex + (event.key === 'ArrowDown' ? 1 : -1),
                );
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                const entries = suggestions.querySelectorAll<HTMLButtonElement>(
                    '.soeditor-ui__link-suggestion',
                );
                entries.item(activeIndex)?.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                clearSuggestions();
            }
        });
        href.addEventListener('blur', clearSuggestions);
        container.append(suggestions);
    }

    if (typeof provider?.select === 'function') {
        const chooseFile = document.createElement('button');
        chooseFile.type = 'button';
        chooseFile.className = 'soeditor-ui__link-file';
        chooseFile.title = translate('Choose file link');
        chooseFile.setAttribute('aria-label', translate('Choose file link'));
        const icon = document.createElement('span');
        icon.className = 'soeditor-ui__link-file-icon';
        fileIcon(icon);
        chooseFile.append(icon);
        chooseFile.addEventListener('click', () => {
            clearSuggestions();
            chooseFile.disabled = true;
            chooseFile.setAttribute('aria-busy', 'true');
            void Promise.resolve()
                .then(() => provider.select('file'))
                .then((selected) => {
                    if (selected === null || !href.isConnected) return;
                    href.value = selected.href;
                    if (selected.title) title.value = selected.title;
                    if (!selectedText && !displayed.value && selected.title)
                        displayed.value = selected.title;
                    clearSuggestions();
                    href.focus();
                })
                .catch(report)
                .finally(() => {
                    chooseFile.disabled = false;
                    chooseFile.removeAttribute('aria-busy');
                });
        });
        fileButtonContainer.append(chooseFile);
    }

    return () => {
        searchVersion++;
        if (searchTimer !== undefined) clearTimeout(searchTimer);
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
<div><strong>Additional attributes</strong><p>Add standard or CMS attributes. Reserved names are blocked.</p></div>
<div class="soeditor-ui__link-attribute-row">
<label class="soeditor-ui__field"><span>Attribute name</span><input data-role="name" aria-label="Attribute name" list="${prefix}-names" maxlength="64" autocomplete="off" placeholder="Choose or enter an attribute name"></label>
<label class="soeditor-ui__field"><span>Attribute value</span><input data-role="value" aria-label="Attribute value" maxlength="4096" autocomplete="off"></label>
<button data-role="add" type="button" class="soeditor-ui__dialog-action">Add attribute</button>
</div>
<div class="soeditor-ui__link-rel-custom">
<label class="soeditor-ui__field"><span>Added attributes</span><select data-role="list"></select></label>
<button data-role="remove" type="button" class="soeditor-ui__dialog-action is-danger">Remove attribute</button>
</div>
<p data-role="empty" class="soeditor-ui__link-attributes-empty">No additional attributes.</p>
<datalist id="${prefix}-names"></datalist><datalist id="${prefix}-values"></datalist>`;
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

export function appendExactTablePicker(
    document: Document,
    container: HTMLElement,
    status: HTMLElement,
    insertTable: (rows: number, columns: number) => boolean,
    close: () => void,
): void {
    const exact = document.createElement('fieldset');
    exact.className = 'soeditor-ui__table-picker-exact';
    exact.innerHTML =
        '<legend>Exact size</legend><input type=number min=1 max=100 value=3 aria-label="Table rows"><input type=number min=1 max=100 value=3 aria-label="Table columns"><button type=button>Insert</button>';
    const inputs = exact.getElementsByTagName('input');
    const rows = inputs.item(0);
    const columns = inputs.item(1);
    const insert = exact.querySelector('button');
    if (!rows || !columns || !insert) return;
    insert.addEventListener('click', () => {
        const rowCount = +rows.value;
        const columnCount = +columns.value;
        if (
            !rows.checkValidity() ||
            !columns.checkValidity() ||
            rowCount * columnCount > 1000
        ) {
            status.textContent = 'Limits: 1–100 each; 1000 cells.';
            return;
        }
        if (insertTable(rowCount, columnCount)) close();
    });
    container.append(exact);
}
